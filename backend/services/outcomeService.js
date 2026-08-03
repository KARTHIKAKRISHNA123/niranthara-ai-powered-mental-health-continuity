// backend/services/outcomeService.js
//
// THE INTERVENTION → OUTCOME LOOP.
//
// Everything before this measured *risk*. Nothing measured whether acting on
// that risk helped. A JITAI fired, the patient may or may not have engaged, and
// the record ended there — so the system could never answer the one question a
// psychiatrist actually asks: "you told me she was deteriorating; what happened
// after you told me?"
//
// This module closes the loop by pairing each delivered intervention with what
// the patient did next:
//
//   intervention delivered
//     -> engagement    (opened / completed / dismissed / ignored)
//     -> proximal outcome  (mood at the next check-in vs the 3 before it)
//     -> distal outcome    (PHQ-9 at the next assessment vs the one before)
//     -> per-user effectiveness, which feeds the next intervention choice
//
// DESIGN NOTE — bounded exploration, not reinforcement learning:
// RL needs thousands of episodes per patient and searches without a ceiling.
// At MVP scale (tens of interventions per user) the honest estimator is a
// paired pre/post mean difference per intervention type, shrunk toward the
// population mean so three lucky observations cannot crown a winner. That is
// interpretable, safe, and defensible to a clinician. RL belongs on the roadmap,
// not in a system that is making live care suggestions.

const { db } = require('../config/firebase')
const { normalizeIntervention } = require('../utils/interventions')

// Engagement, read from the fields the writers ACTUALLY set.
//
// This function is the join that was broken: it used to read `userResponse` /
// `completed` / `opened` / `dismissed`, none of which any live code path wrote —
// only the demo seeder did. jitaiRoutes writes `responseType` + `openedByUser`;
// jitaiScheduler writes `notificationSent`. The result was that on any real
// account every intervention resolved to 'ignored' and engagementRate was a
// constant 0%, which made the entire learning half of the loop inert.
const engagementOf = (j) => {
  const rt = j.responseType || j.userResponse
  if (rt === 'feel_better' || rt === 'need_more_help' || rt === 'completed') return 'completed'
  if (rt === 'dismissed') return 'dismissed'
  if (rt === 'ignored')   return 'ignored'
  if (j.completedAt)      return 'completed'
  if (j.openedByUser || rt === 'opened') return 'opened'
  if (j.notificationSent) return 'ignored'
  return 'not_delivered'
}

// A JITAI is judged against the check-in that follows it, within this window.
// Shorter and most interventions have no follow-up yet; longer and unrelated
// life events dominate the signal.
const PROXIMAL_WINDOW_HOURS = 72
const BASELINE_LOOKBACK = 3        // check-ins before the intervention
const SHRINKAGE_STRENGTH = 3       // pseudo-observations pulling toward population mean

const hours = (a, b) => Math.abs(new Date(a) - new Date(b)) / 3.6e6
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

async function byUid(col, uid, field = 'uid') {
  try {
    const snap = await db.collection(col).where(field, '==', uid).get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch { return [] }
}

/**
 * Pair every intervention for a user with its proximal and distal outcome.
 * Idempotent: re-running recomputes and overwrites, so a late check-in that
 * lands after the first pass is picked up on the next.
 */
async function computeOutcomes(uid) {
  const [jitai, moods, assessments] = await Promise.all([
    byUid('jitaiLogs', uid),
    byUid('moodLogs', uid),
    byUid('assessments', uid),
  ])

  const byTime = (a, b) => new Date(a) - new Date(b)
  const moodsSorted = moods
    .filter(m => m.createdAt && typeof m.moodScore === 'number')
    .sort((a, b) => byTime(a.createdAt, b.createdAt))
  const phq = assessments
    .filter(a => a.type === 'phq9' && a.createdAt)
    .sort((a, b) => byTime(a.createdAt, b.createdAt))

  const results = []

  for (const j of jitai) {
    const t = j.timestamp || j.createdAt
    if (!t) continue

    // ── Proximal: mood at the next check-in vs the patient's own recent baseline
    const before = moodsSorted.filter(m => new Date(m.createdAt) < new Date(t)).slice(-BASELINE_LOOKBACK)
    const after  = moodsSorted.find(m => new Date(m.createdAt) > new Date(t) &&
                                          hours(m.createdAt, t) <= PROXIMAL_WINDOW_HOURS)

    const baselineMood = mean(before.map(m => m.moodScore))
    const moodDelta = (after && baselineMood != null)
      ? Math.round((after.moodScore - baselineMood) * 100) / 100
      : null

    // ── Distal: PHQ-9 either side of the intervention (lower = better)
    const phqBefore = [...phq].reverse().find(a => new Date(a.createdAt) < new Date(t))
    const phqAfter  = phq.find(a => new Date(a.createdAt) > new Date(t))
    const phqDelta  = (phqBefore && phqAfter) ? phqAfter.score - phqBefore.score : null

    // ── Engagement, from the existing /jitai/log-response path
    const engagement = engagementOf(j)

    results.push({
      uid,
      jitaiLogId:        j.id,
      // Normalised on read: historic docs carry pre-vocabulary names
      // (somatic_breathing, crisis_check, gentle_nudge) and would otherwise
      // split one patient's history across several phantom intervention types.
      interventionType:  normalizeIntervention(j.interventionType || j.type),
      // 'jitai' = system-initiated (the attrition-relevant kind);
      // 'self_initiated' = patient opened the exercise themselves.
      source:            j.source || (j.notificationSent ? 'jitai' : 'self_initiated'),
      deliveredAt:       t,
      engagement,
      engaged:           ['completed', 'opened', 'accepted'].includes(engagement),
      baselineMood:      baselineMood != null ? Math.round(baselineMood * 100) / 100 : null,
      followUpMood:      after ? after.moodScore : null,
      followUpAt:        after ? after.createdAt : null,
      moodDelta,
      phqBefore:         phqBefore ? phqBefore.score : null,
      phqAfter:          phqAfter ? phqAfter.score : null,
      phqDelta,
      // Outcome is only "measured" once a follow-up check-in actually exists.
      status:            moodDelta != null ? 'measured' : (after ? 'partial' : 'awaiting_followup'),
      computedAt:        new Date().toISOString(),
    })
  }

  // Fixed doc ids keep this idempotent.
  if (results.length) {
    for (let i = 0; i < results.length; i += 400) {
      const batch = db.batch()
      results.slice(i, i + 400).forEach(r =>
        batch.set(db.collection('interventionOutcomes').doc(`${uid}_${r.jitaiLogId}`), r, { merge: true }))
      await batch.commit()
    }
  }
  return results
}

/**
 * Per-intervention-type effectiveness for one user.
 *
 * Shrunk mean: (n * userMean + k * populationMean) / (n + k).
 * With n=1 the estimate stays near the population value; it only moves toward
 * this patient's own data as evidence accumulates. This is what stops "one good
 * breathing session" from being reported as a proven treatment.
 */
function summarise(outcomes, populationMean = 0) {
  const measured = outcomes.filter(o => o.status === 'measured')
  const byType = {}

  for (const o of measured) {
    (byType[o.interventionType] ||= []).push(o)
  }

  const perType = Object.entries(byType).map(([type, rows]) => {
    const deltas = rows.map(r => r.moodDelta)
    const raw = mean(deltas)
    const n = deltas.length
    const shrunk = (n * raw + SHRINKAGE_STRENGTH * populationMean) / (n + SHRINKAGE_STRENGTH)
    const engagedRows = rows.filter(r => r.engaged)
    return {
      interventionType: type,
      n,
      engagementRate:   Math.round((engagedRows.length / rows.length) * 100),
      rawMoodDelta:     Math.round(raw * 100) / 100,
      // The number to act on — reported separately from the raw mean so a
      // clinician can see both the observation and the tempered estimate.
      estimatedEffect:  Math.round(shrunk * 100) / 100,
      confidence:       n >= 8 ? 'moderate' : n >= 4 ? 'low' : 'insufficient',
    }
  }).sort((a, b) => b.estimatedEffect - a.estimatedEffect)

  const phqPairs = outcomes.filter(o => o.phqDelta != null)
  const delivered = outcomes.filter(o => o.engagement !== 'not_delivered')

  // Engagement rate is an ATTRITION metric, so it is computed over
  // system-initiated interventions only. Counting exercises the patient opened
  // unprompted would inflate it — those prove engagement, they don't measure
  // whether our outreach reaches someone who is disengaging.
  const pushed = outcomes.filter(o => o.source === 'jitai' && o.engagement !== 'not_delivered')

  return {
    totalInterventions:  outcomes.length,
    delivered:           delivered.length,
    measured:            measured.length,
    awaitingFollowUp:    outcomes.filter(o => o.status === 'awaiting_followup').length,
    selfInitiated:       outcomes.filter(o => o.source === 'self_initiated').length,
    engagementRate:      pushed.length ? Math.round(pushed.filter(o => o.engaged).length / pushed.length * 100) : null,
    meanMoodDelta:       measured.length ? Math.round(mean(measured.map(o => o.moodDelta)) * 100) / 100 : null,
    meanPhq9Delta:       phqPairs.length ? Math.round(mean(phqPairs.map(o => o.phqDelta)) * 100) / 100 : null,
    perType,
    // The single ranked recommendation the JITAI selector should prefer next,
    // but only once there is enough evidence to name one honestly.
    bestIntervention:    perType.find(t => t.confidence !== 'insufficient')?.interventionType || null,
  }
}

/** Population mean mood delta across all measured outcomes — the shrinkage target. */
async function populationMeanDelta() {
  try {
    const snap = await db.collection('interventionOutcomes').where('status', '==', 'measured').get()
    const deltas = snap.docs.map(d => d.data().moodDelta).filter(x => typeof x === 'number')
    return deltas.length ? mean(deltas) : 0
  } catch { return 0 }
}

/**
 * Recompute + summarise in one call. This is what the JITAI scheduler and the
 * recovery engine consume: they want "what has worked for this patient", not
 * the raw outcome rows.
 */
async function effectivenessFor(uid) {
  const outcomes = await computeOutcomes(uid)
  const populationMean = await populationMeanDelta()
  return { summary: summarise(outcomes, populationMean), populationMean, outcomes }
}

module.exports = {
  computeOutcomes,
  summarise,
  populationMeanDelta,
  effectivenessFor,
  engagementOf,
  PROXIMAL_WINDOW_HOURS,
}
