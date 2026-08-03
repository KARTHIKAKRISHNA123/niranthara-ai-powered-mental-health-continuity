// backend/scripts/verifyLoop.js
//
// END-TO-END GUARD FOR THE CONTINUITY LOOP.
//
//   node scripts/verifyLoop.js           # run everything, clean up after
//   node scripts/verifyLoop.js --keep    # leave the synthetic patient in place
//   node scripts/verifyLoop.js --offline # skip the checks that need :8000
//
// WHY THIS EXISTS:
// The loop broke silently once already, and nothing caught it. Engagement was
// written to `responseType` and read from `userResponse`, so on a real account
// every intervention scored as "ignored" and engagementRate was a constant 0% —
// while the seeded demo data looked perfect, because the seeder happened to
// write the field the reader wanted. A demo that passes on seeded data and fails
// on a live account is the single worst failure mode this project has.
//
// So this script asserts the loop on data it creates itself, through the real
// service functions, with no seeding shortcuts. Every join that has broken
// before has a named test here.
//
// It writes to Firestore under a namespaced synthetic uid and deletes only the
// documents carrying that uid.

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { db } = require('../config/firebase')
const { computeOutcomes, summarise, engagementOf } = require('../services/outcomeService')
const { normalizeIntervention, INTERVENTION_IDS } = require('../utils/interventions')
const { computeScore, residualSymptoms } = require('../services/recoveryService')
const { ai } = require('../utils/aiClient')

const KEEP    = process.argv.includes('--keep')
const OFFLINE = process.argv.includes('--offline')
const UID     = `__verifyloop_${Date.now()}`

let pass = 0, fail = 0
const results = []

const ok = (name, cond, detail = '') => {
  if (cond) { pass++; results.push(`  PASS  ${name}`) }
  else      { fail++; results.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

const iso = (daysAgo, hour = 12) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const created = { moodLogs: [], jitaiLogs: [], assessments: [], recoveryPlans: [], recoveryScores: [] }

const add = async (col, data) => {
  const ref = await db.collection(col).add({ ...data, uid: UID })
  created[col].push(ref.id)
  return ref
}

async function cleanup() {
  if (KEEP) {
    console.log(`\n--keep set. Synthetic patient left in Firestore as ${UID}`)
    return
  }
  for (const [col, ids] of Object.entries(created)) {
    for (const id of ids) await db.collection(col).doc(id).delete().catch(() => {})
  }
  // computeOutcomes writes interventionOutcomes docs keyed `${uid}_${jitaiLogId}`.
  const snap = await db.collection('interventionOutcomes').where('uid', '==', UID).get().catch(() => ({ docs: [] }))
  for (const d of snap.docs) await d.ref.delete().catch(() => {})
  await db.collection('users').doc(UID).delete().catch(() => {})
}

async function main() {
  console.log(`\nNIRANTHARA — continuity loop verification\nsynthetic patient: ${UID}\n${'-'.repeat(64)}`)

  // ── 0 · Vocabulary. The join that split effectiveness across phantom types.
  console.log('\n[0] Shared intervention vocabulary')
  ok('somatic_breathing normalises to breathing', normalizeIntervention('somatic_breathing') === 'breathing')
  ok('crisis_check normalises to grounding',      normalizeIntervention('crisis_check') === 'grounding')
  ok('gentle_nudge normalises to checkin_nudge',  normalizeIntervention('gentle_nudge') === 'checkin_nudge')
  ok('canonical ids pass through unchanged',      INTERVENTION_IDS.every(i => normalizeIntervention(i) === i))
  ok('unknown input does not silently become a real type', normalizeIntervention('wat') === 'unknown')

  // ── 1 · Engagement resolution, against the fields the writers actually set.
  console.log('\n[1] Engagement resolution')
  ok('responseType feel_better  -> completed', engagementOf({ responseType: 'feel_better' }) === 'completed')
  ok('responseType need_more_help -> completed', engagementOf({ responseType: 'need_more_help' }) === 'completed')
  ok('openedByUser only -> opened',           engagementOf({ openedByUser: true }) === 'opened')
  ok('delivered, no response -> ignored',     engagementOf({ notificationSent: true }) === 'ignored')
  ok('nothing sent -> not_delivered',         engagementOf({}) === 'not_delivered')
  // The regression that started all of this:
  ok('REGRESSION: a real completed JITAI is never scored as ignored',
     engagementOf({ notificationSent: true, openedByUser: true, responseType: 'feel_better' }) === 'completed')
  // And the seeder's own field still works, so historic demo data survives:
  ok('legacy seeder field userResponse still read', engagementOf({ userResponse: 'completed' }) === 'completed')

  // ── 2 · Build a synthetic patient with a real, measurable history.
  console.log('\n[2] Seeding a synthetic history through the real collections')
  await db.collection('users').doc(UID).set({
    uid: UID, name: 'Loop Verification', role: 'user', riskLevel: 'moderate', riskScore: 0.55,
    tracksCycle: false, createdAt: iso(40),
  })

  // Baseline: three check-ins averaging 2.0 before the intervention.
  for (const [d, m] of [[9, 2], [8, 2], [7, 2]]) {
    await add('moodLogs', { moodScore: m, sleepHours: 5, createdAt: iso(d), date: iso(d) })
  }

  // A delivered, completed intervention six days ago.
  const j1 = await add('jitaiLogs', {
    interventionType: 'somatic_breathing',   // deliberately the LEGACY name
    source: 'jitai', notificationSent: true, openedByUser: true,
    responseType: 'feel_better', completedAt: iso(6, 13),
    timestamp: iso(6), createdAt: iso(6),
  })

  // Follow-up check-in inside the 72h window, mood 4.0 -> delta +2.0.
  await add('moodLogs', { moodScore: 4, sleepHours: 7, createdAt: iso(5), date: iso(5) })

  // A delivered-but-ignored intervention, so engagement is not trivially 100%.
  await add('jitaiLogs', {
    interventionType: 'checkin_nudge', source: 'jitai',
    notificationSent: true, openedByUser: false, responseType: null,
    timestamp: iso(4), createdAt: iso(4),
  })

  // PHQ-9 either side: 18 -> 8. Treatment response, with residual items.
  await add('assessments', { type: 'phq9', score: 18, severity: 'moderately severe',
    answers: [3, 3, 2, 2, 2, 2, 2, 1, 1], createdAt: iso(30) })
  await add('assessments', { type: 'phq9', score: 8, severity: 'mild',
    answers: [2, 1, 2, 1, 0, 1, 1, 0, 0], createdAt: iso(2) })

  // ── 3 · Outcome engine on that history.
  console.log('\n[3] Outcome engine')
  const outcomes = await computeOutcomes(UID)
  const breathing = outcomes.find(o => o.jitaiLogId === j1.id)

  ok('every intervention produced an outcome row', outcomes.length === 2, `got ${outcomes.length}`)
  ok('legacy type was normalised on read', breathing?.interventionType === 'breathing', `got ${breathing?.interventionType}`)
  ok('outcome reached status "measured"', breathing?.status === 'measured', `got ${breathing?.status}`)
  ok('engagement resolved to completed', breathing?.engagement === 'completed', `got ${breathing?.engagement}`)
  ok('engaged flag is true (the 0% bug)', breathing?.engaged === true)
  ok('baseline mood is the prior 3 check-ins', breathing?.baselineMood === 2, `got ${breathing?.baselineMood}`)
  ok('proximal mood delta is +2', breathing?.moodDelta === 2, `got ${breathing?.moodDelta}`)
  ok('distal PHQ-9 delta is -10', breathing?.phqDelta === -10, `got ${breathing?.phqDelta}`)

  const summary = summarise(outcomes, 0)
  ok('engagement rate is 50%, not 0', summary.engagementRate === 50, `got ${summary.engagementRate}`)
  ok('per-type effectiveness computed', summary.perType.length >= 1)
  ok('n=1 is reported as insufficient evidence',
     summary.perType.every(t => t.n >= 4 || t.confidence === 'insufficient'))
  ok('no intervention is crowned on 1 observation', summary.bestIntervention === null,
     `got ${summary.bestIntervention}`)

  // Idempotency — step 9 of moodRoutes reruns this on every check-in.
  const rerun = await computeOutcomes(UID)
  ok('recompute is idempotent', rerun.length === outcomes.length)

  // ── 4 · Recovery engine.
  console.log('\n[4] Recovery engine')
  const phq = [{ score: 18, createdAt: iso(30), answers: [3,3,2,2,2,2,2,1,1] },
               { score: 8,  createdAt: iso(2),  answers: [2,1,2,1,0,1,1,0,0], severity: 'mild' }]
  const moods = [{ moodScore: 2, createdAt: iso(9) }, { moodScore: 2, createdAt: iso(8) },
                 { moodScore: 2, createdAt: iso(7) }, { moodScore: 4, createdAt: iso(5) },
                 { moodScore: 4, createdAt: iso(1) }]
  const score = computeScore({ phq, moods, effectiveness: summary })

  ok('recovery score is produced', score.score != null, score.message)
  ok('recovery score is within 0-100', score.score >= 0 && score.score <= 100, `got ${score.score}`)
  ok('components are exposed, never a bare number', Object.keys(score.components).length >= 3)
  ok('symptom component reflects the 56% PHQ-9 reduction',
     score.components.symptoms && score.components.symptoms.value > 90)
  ok('weights renormalise over present components only', score.weightsRenormalisedOver <= 1.0001)

  const empty = computeScore({ phq: [], moods: [], effectiveness: {} })
  ok('no history yields null, not a fabricated 50', empty.score === null && empty.confidence === 'insufficient')

  const res = residualSymptoms(phq[1])
  // answers [2,1,2,1,0,1,1,0,0] -> items 1 and 3 are the only ones at >= 2
  // ("more than half the days"), so two residual symptoms is the correct count.
  ok('residual symptoms detected below total 10', res.residual.length === 2, `got ${res.residual.length}`)
  ok('residual items are named from the instrument',
     res.residual.some(r => r.item === 1) && res.residual.some(r => r.item === 3))
  const active = residualSymptoms({ score: 18, answers: [3,3,2,2,2,2,2,1,1], createdAt: iso(30) })
  ok('above total 10 they are active, not residual', active.residual.length === 0 && active.active.length > 0)

  // ── 5 · Learning engine (needs the AI service).
  if (OFFLINE) {
    console.log('\n[5] Learning engine — SKIPPED (--offline)')
  } else {
    console.log('\n[5] Learning engine (ai-service :8000)')
    try {
      const sel = await ai.post('/api/outcome/select', {
        uid: UID, perType: summary.perType, populationMean: 0,
        riskLevel: 'moderate', crisisProbability: 0.1, engagementRate: 50, tracksCycle: false,
      }, { timeout: 8000 })
      ok('selector returns a canonical intervention',
         INTERVENTION_IDS.includes(sel.data.recommended), `got ${sel.data.recommended}`)
      ok('selector explains itself', typeof sel.data.rationale === 'string' && sel.data.rationale.length > 10)
      ok('cycle_aware excluded when tracksCycle is false',
         !sel.data.candidates.some(c => c.interventionType === 'cycle_aware'))

      const crisis = await ai.post('/api/outcome/select', {
        uid: UID, perType: summary.perType, populationMean: 0, crisisProbability: 0.9,
      }, { timeout: 8000 })
      ok('SAFETY: crisis overrides learned preference',
         crisis.data.recommended === 'grounding' && crisis.data.selectionMode === 'safety_floor')

      const disengaged = await ai.post('/api/outcome/select', {
        uid: UID, perType: summary.perType, populationMean: 0, engagementRate: 5,
      }, { timeout: 8000 })
      ok('SAFETY: disengagement de-escalates to lowest-effort action',
         disengaged.data.recommended === 'checkin_nudge' && disengaged.data.selectionMode === 'engagement_floor')

      const traj = await ai.post('/api/outcome/trajectory', {
        uid: UID, points: phq.map(p => ({ date: p.createdAt, phq9: p.score })),
      }, { timeout: 8000 })
      ok('trajectory classifies 18 -> 8 as treatment response',
         traj.data.trajectory === 'treatment_response', `got ${traj.data.trajectory}`)

      // Plateau is the state the whole product exists to surface.
      const flat = await ai.post('/api/outcome/trajectory', {
        uid: UID, points: [
          { date: iso(28), phq9: 14 }, { date: iso(21), phq9: 14 },
          { date: iso(14), phq9: 13 }, { date: iso(7),  phq9: 14 },
        ],
      }, { timeout: 8000 })
      ok('flat PHQ-9 series is flagged as plateau', flat.data.trajectory === 'plateau', `got ${flat.data.trajectory}`)
      ok('plateau carries the incomplete-alleviation flag',
         /[Ii]ncomplete symptom alleviation/.test(flat.data.clinicalFlag || ''))

      // The JITAI router must route WHICH through the same selector.
      const jit = await ai.post('/api/jitai/receptivity', {
        uid: UID, riskScore: 0.8, crisisProbability: 0.0, hour_of_day: 19,
        perType: summary.perType, populationMean: 0, engagementRate: 60, tracksCycle: false,
      }, { timeout: 8000 })
      ok('JITAI emits a canonical intervention type',
         jit.data.interventionType === 'none' || INTERVENTION_IDS.includes(jit.data.interventionType),
         `got ${jit.data.interventionType}`)
      ok('JITAI reports HOW it chose (no hidden hardcoding)',
         jit.data.interventionType === 'none' || !!jit.data.selectionMode)
    } catch (e) {
      ok('ai-service reachable on :8000', false, e.message)
    }
  }

  // ── Report
  console.log(`\n${'-'.repeat(64)}`)
  results.forEach(r => console.log(r))
  console.log(`\n${pass} passed, ${fail} failed\n`)

  await cleanup()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error('\nverifyLoop crashed:', e.stack || e.message)
  await cleanup()
  process.exit(1)
})
