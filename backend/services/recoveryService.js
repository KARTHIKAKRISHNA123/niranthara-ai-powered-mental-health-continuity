// backend/services/recoveryService.js
//
// THE RECOVERY ENGINE — the half of the product that acts instead of watching.
//
// Everything upstream of this file answers "how bad is it". A risk score tells a
// patient they are deteriorating, which is information they already have. This
// module answers the two questions that actually change an outcome:
//
//   "am I getting better?"   -> recoveryScore, trajectory, residual symptoms
//   "what do I do today?"    -> a small, concrete, personalised plan
//
// WHY RECOVERY SCORE IS NOT A REPACKAGED RISK SCORE:
//   riskScore     = XGBoost P(deterioration soon).  Predictive, model-derived,
//                   about the future, and it goes UP when things go wrong.
//   recoveryScore = observed progress against this patient's OWN baseline.
//                   Retrospective, deterministic, arithmetic over measured
//                   history, and it is undefined until that history exists.
//   A patient can be high-risk AND recovering (bad week inside a good month);
//   the two numbers are supposed to disagree sometimes. If they never did,
//   one of them would be redundant.
//
// The score is a labelled weighted composite, NOT a model output. That is
// deliberate and it is stated in the API response: a clinician can reproduce it
// on paper. Inventing an ML model to produce a number we can compute exactly
// would be theatre, and it would be unexplainable at the bedside.

const { db } = require('../config/firebase')
const { ai } = require('../utils/aiClient')
const { effectivenessFor } = require('./outcomeService')
const { interventionLabel, interventionScreen } = require('../utils/interventions')

// PHQ-9 item wording, in order. Used for residual-symptom naming — these are
// the instrument's own domains, not categories we invented.
const PHQ9_ITEMS = [
  'Loss of interest or pleasure',
  'Feeling down or hopeless',
  'Sleep disturbance',
  'Fatigue or low energy',
  'Appetite change',
  'Feeling bad about yourself',
  'Trouble concentrating',
  'Moving or speaking slowly / restlessness',
  'Thoughts of self-harm',
]

// Component weights. They are renormalised over whatever is actually present —
// the same partial-data rule biometricRoutes uses, and for the same reason: a
// missing signal must not be scored as a zero. A patient who has never taken a
// PHQ-9 is not a patient with no symptom improvement.
const WEIGHTS = { symptoms: 0.40, adherence: 0.20, engagement: 0.20, mood: 0.20 }

const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const mean  = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const today = () => new Date().toISOString().slice(0, 10)

async function byUid(col, uid) {
  try {
    const snap = await db.collection(col).where('uid', '==', uid).get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch { return [] }
}

/**
 * Residual symptoms — the clinical definition, not a threshold we chose.
 *
 * A PHQ-9 item scored >= 2 means "more than half the days". Items still at that
 * level while the TOTAL has come down is the textbook picture of incomplete
 * response, and it is the single strongest predictor of relapse. It is also
 * invisible to any system that only looks at total scores — which is the gap
 * named in the problem statement.
 */
function residualSymptoms(latestPhq9) {
  if (!latestPhq9 || !Array.isArray(latestPhq9.answers)) return null

  // "No items scored 2+" and "we have no item-level answers" are completely
  // different statements, and conflating them prints a clinical impossibility:
  // a PHQ-9 total of 24 with an empty answers array rendered as "no items
  // scoring 2 or above", which cannot be true (nine items capped at 1 sum to 9).
  // Absence of data must never be displayed as a negative finding.
  if (!latestPhq9.answers.length) {
    return {
      totalScore: latestPhq9.score,
      severity:   latestPhq9.severity,
      itemsAvailable: false,
      residual: [], active: [],
      assessedAt: latestPhq9.createdAt,
    }
  }

  const items = latestPhq9.answers
    .map((v, i) => ({ item: i + 1, symptom: PHQ9_ITEMS[i], severity: v }))
    .filter(x => x.severity >= 2)

  return {
    totalScore: latestPhq9.score,
    severity:   latestPhq9.severity,
    itemsAvailable: true,
    // "Residual" only makes sense once the total has improved out of the
    // moderate+ range; above that these are simply active symptoms.
    residual:   latestPhq9.score < 10 ? items : [],
    active:     latestPhq9.score >= 10 ? items : [],
    assessedAt: latestPhq9.createdAt,
  }
}

/**
 * Recovery score, 0-100, with every component exposed.
 * Never returns a bare number: a composite that hides its drivers is unusable
 * clinically, and the UI is required to render the parts alongside the total.
 */
function computeScore({ phq, moods, effectiveness }) {
  const components = {}

  // ── Symptom relief: reduction from this patient's own first PHQ-9.
  if (phq.length >= 2) {
    const baseline = phq[0].score
    const latest   = phq[phq.length - 1].score
    const pct = baseline > 0 ? (baseline - latest) / baseline : 0
    // 50% reduction is the accepted definition of treatment response, so it
    // anchors to 100 here. Deterioration floors at 0 rather than going negative.
    components.symptoms = {
      value: clamp((pct / 0.5) * 100),
      // "-9% reduction" is a double negative that reads as improvement at a
      // glance. Name the direction instead of signing the noun.
      detail: `PHQ-9 ${baseline} -> ${latest} (${Math.abs(Math.round(pct * 100))}% ${pct >= 0 ? 'reduction' : 'increase'})`,
    }
  }

  // ── Adherence: check-ins over the last 14 days. Daily is the ask, so 14/14
  // is 100. Attrition shows up here first, before it shows up as silence.
  const cutoff = Date.now() - 14 * 86400000
  const recent = moods.filter(m => new Date(m.createdAt).getTime() >= cutoff)
  if (moods.length) {
    components.adherence = {
      value: clamp((recent.length / 14) * 100),
      detail: `${recent.length} check-ins in the last 14 days`,
    }
  }

  // ── Engagement with delivered interventions.
  if (effectiveness && effectiveness.engagementRate != null) {
    components.engagement = {
      value: clamp(effectiveness.engagementRate),
      detail: `${effectiveness.engagementRate}% of interventions engaged with`,
    }
  }

  // ── Mood movement: last 7 days against the 7 before them. Mood is 1-5, so a
  // full 1-point gain maps to the top of the band; this is intentionally
  // insensitive to single bad days.
  if (moods.length >= 4) {
    const sorted = [...moods].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const week   = Date.now() - 7 * 86400000
    const prior  = Date.now() - 14 * 86400000
    const now7   = sorted.filter(m => new Date(m.createdAt).getTime() >= week).map(m => m.moodScore)
    const prev7  = sorted.filter(m => {
      const t = new Date(m.createdAt).getTime()
      return t >= prior && t < week
    }).map(m => m.moodScore)

    const a = mean(now7), b = mean(prev7.length ? prev7 : sorted.slice(0, 3).map(m => m.moodScore))
    if (a != null && b != null) {
      components.mood = {
        value: clamp(50 + (a - b) * 50),   // no change = 50, +1.0 mood = 100
        detail: `Mood ${b.toFixed(1)} -> ${a.toFixed(1)} over the last week`,
      }
    }
  }

  const present = Object.keys(components)
  if (!present.length) {
    return {
      score: null,
      confidence: 'insufficient',
      components,
      // Honest emptiness beats a fabricated 50. The UI renders this sentence.
      message: 'Not enough history yet — a recovery score needs at least a few check-ins.',
    }
  }

  const totalWeight = present.reduce((s, k) => s + WEIGHTS[k], 0)
  const score = present.reduce((s, k) => s + components[k].value * WEIGHTS[k], 0) / totalWeight

  return {
    score: Math.round(score),
    // Confidence is about how much of the composite we could actually measure.
    confidence: present.length >= 3 ? 'good' : present.length === 2 ? 'partial' : 'low',
    componentsPresent: present,
    componentsMissing: Object.keys(WEIGHTS).filter(k => !present.includes(k)),
    weightsRenormalisedOver: Math.round(totalWeight * 100) / 100,
    components,
  }
}

/**
 * Today's recovery plan.
 *
 * Small on purpose. A depressed patient handed twelve tasks completes none, and
 * an uncompleted plan is worse than no plan — it is one more piece of evidence
 * for the belief that they are failing. Three to four goals, each tied to
 * something the system actually measured, each with the reason shown.
 */
function buildGoals({ symptoms, adaptive, moods, user }) {
  const goals = []
  const residual = symptoms?.residual || symptoms?.active || []
  const has = (n) => residual.some(r => r.item === n)

  // 1 — The adaptive intervention. This is the outcome loop reaching the patient:
  // the exercise chosen is the one that measurably helped THIS person.
  if (adaptive?.recommended) {
    goals.push({
      id: `intervention_${adaptive.recommended}`,
      type: 'intervention',
      interventionType: adaptive.recommended,
      screen: interventionScreen(adaptive.recommended),
      label: interventionLabel(adaptive.recommended),
      rationale: adaptive.rationale,
      minutes: 5,
    })
  }

  // 2 — Sleep, if the instrument says sleep. PHQ-9 item 3.
  const avgSleep = mean(moods.slice(-7).map(m => m.sleepHours).filter(x => typeof x === 'number'))
  if (has(3) || (avgSleep != null && avgSleep < 6)) {
    goals.push({
      id: 'sleep_window',
      type: 'lifestyle',
      label: 'Lights out by 11pm',
      rationale: has(3)
        ? 'Sleep disturbance is still scoring on your PHQ-9.'
        : `Your last week averaged ${avgSleep.toFixed(1)}h of sleep.`,
      minutes: null,
    })
  }

  // 3 — Behavioural activation for fatigue / anhedonia. PHQ-9 items 1 and 4.
  // This is the one evidence-based self-help action for anhedonia, and it is
  // deliberately tiny: "a walk", not "exercise".
  if (has(1) || has(4)) {
    goals.push({
      id: 'activation_walk',
      type: 'lifestyle',
      label: 'Step outside for 10 minutes',
      rationale: has(1)
        ? 'Loss of interest is a residual symptom — small activity first, motivation after.'
        : 'Low energy is still scoring; short movement is the usual first step.',
      minutes: 10,
    })
  }

  // 4 — The check-in itself. Always present: it is the measurement the whole
  // loop depends on, and completing it is what keeps a patient from silently
  // dropping out of follow-up.
  const loggedToday = moods.some(m => (m.createdAt || '').slice(0, 10) === today())
  goals.push({
    id: 'daily_checkin',
    type: 'checkin',
    label: 'Log how today went',
    rationale: 'Your check-in is what lets us tell whether any of this is working.',
    minutes: 2,
    preCompleted: loggedToday,
  })

  // 5 — Medication, only if the patient has told us they take one. Never
  // invented, and never dose-related: a reminder, not advice.
  if (user?.medication?.name) {
    goals.push({
      id: 'medication',
      type: 'medication',
      label: `Take ${user.medication.name}${user.medication.time ? ` at ${user.medication.time}` : ''}`,
      rationale: 'You asked to be reminded about this.',
      minutes: null,
    })
  }

  return goals.slice(0, 5)
}

/**
 * Assemble everything: score, trajectory, residual symptoms, today's plan.
 * Idempotent per day — re-reads the stored plan so completions survive reloads.
 */
async function getRecovery(uid) {
  const [userDoc, moodsRaw, assessments, eff] = await Promise.all([
    db.collection('users').doc(uid).get(),
    byUid('moodLogs', uid),
    byUid('assessments', uid),
    effectivenessFor(uid).catch(() => ({ summary: { perType: [], engagementRate: null }, populationMean: 0 })),
  ])

  const user = userDoc.exists ? userDoc.data() : {}
  const moods = moodsRaw
    .filter(m => m.createdAt && typeof m.moodScore === 'number')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const phq = assessments
    .filter(a => a.type === 'phq9' && a.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  const symptoms = residualSymptoms(phq[phq.length - 1])
  const score    = computeScore({ phq, moods, effectiveness: eff.summary })

  // Trajectory + adaptive choice both come from the AI service. Failures are
  // non-fatal: the plan degrades to its non-adaptive form rather than 500ing,
  // because a patient opening the app must always get a plan.
  const [trajectory, adaptive] = await Promise.all([
    phq.length >= 2
      ? ai.post('/api/outcome/trajectory', {
          uid, points: phq.map(a => ({ date: a.createdAt, phq9: a.score })),
        }, { timeout: 8000 }).then(r => r.data).catch(() => null)
      : Promise.resolve({ trajectory: 'insufficient_data', message: 'At least two PHQ-9 scores are needed.' }),
    ai.post('/api/outcome/select', {
      uid,
      perType: eff.summary.perType || [],
      populationMean: eff.populationMean || 0,
      riskLevel: user.riskLevel || 'low',
      crisisProbability: moods[moods.length - 1]?.nlpResults?.crisisProbability || 0,
      engagementRate: eff.summary.engagementRate,
      tracksCycle: user.tracksCycle === true || user.personaType === 'women',
    }, { timeout: 8000 }).then(r => r.data).catch(() => null),
  ])

  // Persisted plan for today, so ticking a goal is durable.
  const planId  = `${uid}_${today()}`
  const planRef = db.collection('recoveryPlans').doc(planId)
  const existing = await planRef.get()

  // The selection is STOCHASTIC (Thompson-style sampling in outcome.py), so it
  // must be persisted with the plan and read back — not resampled per request.
  // Otherwise the plan goal built from the first sample and the "recommended
  // next action" card rendered from a fresh sample disagree on the same screen,
  // and a clinician sees the plan say "thought reframing" next to a card saying
  // "breathing". One decision per day, recorded.
  let goals, selection
  if (existing.exists) {
    goals     = existing.data().goals
    selection = existing.data().adaptiveSelection || adaptive
  } else {
    goals = buildGoals({ symptoms, adaptive, moods, user }).map(g => ({
      ...g, done: !!g.preCompleted, doneAt: g.preCompleted ? new Date().toISOString() : null,
    }))
    selection = adaptive
    await planRef.set({
      uid, date: today(), goals,
      adaptiveSelection: adaptive,
      createdAt: new Date().toISOString(),
    })
  }

  // Store today's score so the trend line is real history, not recomputed
  // retrospectively from whatever the data looks like now.
  if (score.score != null) {
    await db.collection('recoveryScores').doc(planId)
      .set({ uid, date: today(), score: score.score, confidence: score.confidence,
             components: score.components, createdAt: new Date().toISOString() }, { merge: true })
      .catch(() => {})
  }

  return {
    uid,
    recoveryScore: score,
    trajectory,
    symptoms,
    plan: { date: today(), goals, completed: goals.filter(g => g.done).length, total: goals.length },
    adaptiveSelection: selection,
    effectiveness: eff.summary,
    // Method disclosure travels with the numbers — a clinician should never
    // have to guess whether something is a model output or arithmetic.
    method: {
      recoveryScore: 'Weighted composite of measured components, renormalised over present signals. Deterministic, not a model output.',
      residualSymptoms: 'PHQ-9 items scoring >= 2 ("more than half the days") while total score is below 10.',
      trajectory: 'OLS slope over the PHQ-9 series (ai-service /api/outcome/trajectory).',
      adaptiveSelection: 'Shrunk per-intervention effect with crisis and engagement safety floors.',
    },
  }
}

/** Trend of stored daily scores — real history, ascending. */
async function scoreHistory(uid, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const rows = (await byUid('recoveryScores', uid))
    .filter(r => r.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
  return rows.map(r => ({ date: r.date, score: r.score, confidence: r.confidence }))
}

/** Mark one goal done/undone on today's plan. */
async function completeGoal(uid, goalId, done = true) {
  const ref = db.collection('recoveryPlans').doc(`${uid}_${today()}`)
  const snap = await ref.get()
  if (!snap.exists) return { error: 'No plan for today yet' }

  const goals = snap.data().goals.map(g =>
    g.id === goalId ? { ...g, done, doneAt: done ? new Date().toISOString() : null } : g)
  await ref.update({ goals, updatedAt: new Date().toISOString() })

  return { goals, completed: goals.filter(g => g.done).length, total: goals.length }
}

module.exports = { getRecovery, completeGoal, scoreHistory, residualSymptoms, computeScore, PHQ9_ITEMS }
