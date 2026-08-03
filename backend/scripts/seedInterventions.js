// backend/scripts/seedInterventions.js
// Seeds JITAI delivery history so the intervention->outcome loop has something
// to measure. Deterministic per uid, idempotent (fixed doc ids), dry-run first.
//
//   node scripts/seedInterventions.js            # report
//   node scripts/seedInterventions.js --apply
//
// The generated pattern is deliberately NOT uniform: different intervention
// types have genuinely different effects per patient, and some deliveries are
// ignored. A flat dataset would make the effectiveness panel look broken.

const { db } = require('../config/firebase')
const { INTERVENTION_IDS } = require('../utils/interventions')
const APPLY = process.argv.includes('--apply')

// Drawn from the shared vocabulary, not a private copy — a seeder that invents
// its own type names produces a demo that cannot be reproduced by real usage.
const TYPES = INTERVENTION_IDS.filter(t => t !== 'grounding' && t !== 'cycle_aware')

// Written in the SAME fields the live app writes (responseType / openedByUser),
// not the seeder-only `userResponse` this file used to use. That mismatch was
// how the loop stayed broken for so long: seeded data satisfied the outcome
// reader while real completions did not, so the demo passed and the product
// failed. Seed data must be shape-identical to production data or it verifies
// nothing.
const RESPONSES = [
  { responseType: 'feel_better',    openedByUser: true  },
  { responseType: 'feel_better',    openedByUser: true  },
  { responseType: 'need_more_help', openedByUser: true  },
  { responseType: null,             openedByUser: true  },   // opened, not finished
  { responseType: null,             openedByUser: false },   // ignored
]

function rng(seed) {
  let s = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) || 7
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
}

;(async () => {
  console.log(`\n=== Seed JITAI interventions ${APPLY ? '(APPLYING)' : '(DRY RUN — use --apply)'} ===\n`)
  const users = (await db.collection('users').get()).docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.role !== 'clinician')

  const ops = []
  for (const u of users) {
    const existing = await db.collection('jitaiLogs').where('uid', '==', u.id).get()
    if (existing.size >= 5) { console.log(`  · ${u.name || u.id}: ${existing.size} jitaiLogs — skipping`); continue }

    const rand = rng(u.id)
    const moods = (await db.collection('moodLogs').where('uid', '==', u.id).get()).docs
      .map(d => d.data()).filter(m => m.createdAt)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    if (moods.length < 4) { console.log(`  ! ${u.name || u.id}: only ${moods.length} mood logs — need >=4 to measure outcomes`); continue }

    // Place an intervention shortly BEFORE some check-ins so each has a
    // genuine follow-up measurement inside the 72h window.
    let n = 0
    moods.forEach((m, i) => {
      if (i < 2 || i % 2 === 1) return
      const when = new Date(new Date(m.createdAt).getTime() - (6 + rand() * 30) * 3.6e6).toISOString()
      const type = TYPES[Math.floor(rand() * TYPES.length)]
      const eng  = RESPONSES[Math.floor(rand() * RESPONSES.length)]
      ops.push({
        ref: db.collection('jitaiLogs').doc(`seed_${u.id}_${i}`),
        data: {
          uid: u.id, interventionType: type, source: 'jitai', timestamp: when, createdAt: when,
          receptivityScore: Math.round((0.4 + rand() * 0.5) * 100) / 100,
          notificationSent: true,
          responseType: eng.responseType, openedByUser: eng.openedByUser,
          completedAt: eng.responseType ? when : null,
          triggerReason: 'seeded demo history', modelVersion: 'seed', seeded: true,
        },
      })
      n++
    })
    console.log(`  ${APPLY ? '✓' : '·'} ${u.name || u.id}: +${n} interventions across ${moods.length} check-ins`)
  }

  if (APPLY && ops.length) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = db.batch()
      ops.slice(i, i + 400).forEach(o => b.set(o.ref, o.data, { merge: true }))
      await b.commit()
    }
    console.log(`\nWrote ${ops.length} jitaiLogs.`)

    const { computeOutcomes, summarise, populationMeanDelta } = require('../services/outcomeService')
    const pop = await populationMeanDelta()
    console.log('\nComputing outcomes…')
    for (const u of users) {
      const out = await computeOutcomes(u.id)
      const s = summarise(out, pop)
      if (s.totalInterventions)
        console.log(`  ${(u.name || u.id).padEnd(22)} delivered ${String(s.delivered).padStart(2)}  measured ${String(s.measured).padStart(2)}  engagement ${String(s.engagementRate ?? '—').padStart(3)}%  meanMoodDelta ${s.meanMoodDelta ?? '—'}  best: ${s.bestIntervention || '(insufficient evidence)'}`)
    }
  } else if (!APPLY) {
    console.log(`\n${ops.length} interventions would be created. Re-run with --apply.`)
  }
  process.exit(0)
})().catch(e => { console.error('FAILED:', e); process.exit(1) })
