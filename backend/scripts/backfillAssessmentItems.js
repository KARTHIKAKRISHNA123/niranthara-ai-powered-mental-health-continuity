// backend/scripts/backfillAssessmentItems.js
//
//   node scripts/backfillAssessmentItems.js            # dry run (default)
//   node scripts/backfillAssessmentItems.js --apply    # write
//
// WHY THIS EXISTS:
// The demo seeder wrote PHQ-9 documents with `answers: []` — a total score and
// no item breakdown. Residual-symptom detection reads item scores, so it found
// nothing for every seeded patient, and the dashboard rendered "no items scoring
// 2 or above" beside a PHQ-9 total of 24. That is arithmetically impossible
// (nine items capped at 1 sum to 9) and it is the kind of detail a clinician
// notices immediately.
//
// The display bug is fixed separately in recoveryService/RecoveryPanel: missing
// items are now reported as missing. This script fixes the DATA, so the feature
// can actually be demonstrated.
//
// SAFETY: only touches documents with `seeded === true` AND an empty answers
// array. A real patient submission always carries its own item answers and is
// never rewritten — fabricating item-level clinical responses for a real person
// would be indefensible.

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { db } = require('../config/firebase')

const APPLY = process.argv.includes('--apply')

const MAX_ITEM = 3
const ITEMS = { phq9: 9, gad7: 7 }

// Core depressive/anxiety items carry more of the total than peripheral ones,
// so the generated profile looks like a real presentation rather than a flat
// spread. Deterministic per document — reruns produce identical answers.
const WEIGHTS = {
  phq9: [3, 3, 3, 3, 2, 2, 2, 1, 1],
  gad7: [3, 3, 3, 2, 2, 2, 1],
}

const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}

/** Distribute `total` across items, capped at 3 each, weighted, deterministic. */
function distribute(total, type, seed, selfHarm) {
  const n = ITEMS[type]
  const answers = new Array(n).fill(0)
  let remaining = Math.max(0, Math.min(total, n * MAX_ITEM))

  // PHQ-9 item 9 is the self-harm item and must agree with the stored flag —
  // it drives a separate alert path, so it cannot be invented independently.
  if (type === 'phq9') {
    const nine = selfHarm ? 1 + (seed % 2) : 0
    answers[8] = Math.min(nine, remaining)
    remaining -= answers[8]
  }

  const order = WEIGHTS[type]
    .map((w, i) => ({ i, w }))
    .filter(x => !(type === 'phq9' && x.i === 8))
    .sort((a, b) => (b.w - a.w) || ((hash(`${seed}:${a.i}`) % 7) - (hash(`${seed}:${b.i}`) % 7)))

  // Fill heaviest-weighted items first, one level at a time, so the total is
  // matched exactly rather than approximately.
  for (let level = 1; level <= MAX_ITEM && remaining > 0; level++) {
    for (const { i } of order) {
      if (remaining <= 0) break
      if (answers[i] >= level) continue
      answers[i] = level
      remaining -= 1
    }
  }
  return answers
}

async function main() {
  console.log(`\nAssessment item backfill — ${APPLY ? 'APPLY' : 'DRY RUN'}\n${'-'.repeat(60)}`)
  const snap = await db.collection('assessments').get()

  let fixed = 0, skippedReal = 0, ok = 0
  for (const doc of snap.docs) {
    const a = doc.data()
    const type = a.type
    if (!ITEMS[type]) continue

    const hasItems = Array.isArray(a.answers) && a.answers.length > 0
    if (hasItems) { ok++; continue }
    if (a.seeded !== true) {
      skippedReal++
      console.log(`  SKIP  ${doc.id} — real submission with no items; not fabricating`)
      continue
    }

    const answers = distribute(a.score, type, hash(doc.id), a.selfHarmFlag === true)
    const sum = answers.reduce((s, x) => s + x, 0)
    console.log(`  FIX   ${type} ${String(a.score).padStart(2)} -> [${answers.join(',')}] sum=${sum}` +
                (sum !== a.score ? `  !! MISMATCH` : ''))
    if (APPLY) await doc.ref.update({ answers, answersBackfilled: true })
    fixed++
  }

  console.log(`\n${fixed} backfilled · ${ok} already had items · ${skippedReal} real docs left alone`)
  if (!APPLY) console.log('\nDry run. Re-run with --apply to write.\n')
  process.exit(0)
}

main().catch(e => { console.error(e.message); process.exit(1) })
