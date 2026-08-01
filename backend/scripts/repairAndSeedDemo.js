// backend/scripts/repairAndSeedDemo.js
//
// Brings Firestore into the state the dashboard and the demo actually need.
// Safe to re-run: every write is idempotent (fixed doc ids / merge).
//
//   node scripts/repairAndSeedDemo.js            # report only, changes nothing
//   node scripts/repairAndSeedDemo.js --apply    # perform the repairs
//   node scripts/repairAndSeedDemo.js --apply --link-me <uid> "Your Name"
//
// What it fixes, and why each one mattered:
//   1. Demo patients existed but had ZERO mood logs — so their charts, SHAP
//      panel and AI summary were all empty. Backfills 30 days of coherent logs.
//   2. gender / tracksCycle absent on every user — the new gender-aware UI
//      falls back to legacy persona guessing without them.
//   3. clinicianAlerts missing clinicianUid are invisible to the dashboard.
//   4. Duplicate/orphan patient docs pointing at a clinician uid that does not
//      exist clutter the caseload and can never be opened.
//   5. A real (self-registered) account has no name/role/assignedClinician, so
//      it never appears in the clinician's caseload — use --link-me for that.

const { db } = require('../config/firebase')

const APPLY   = process.argv.includes('--apply')
const linkIdx = process.argv.indexOf('--link-me')
const LINK_ME = linkIdx > -1 ? process.argv[linkIdx + 1] : null
const LINK_NAME = linkIdx > -1 ? (process.argv[linkIdx + 2] || 'Primary User') : null

const changes = []
const note = (msg) => { changes.push(msg); console.log(`  ${APPLY ? '✓' : '·'} ${msg}`) }

// Deterministic pseudo-random so re-runs produce identical data.
function rng(seed) {
  let s = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

// Build a 30-day trajectory consistent with the patient's stated risk level.
function buildMoodLogs(uid, riskLevel, seed) {
  const rand = rng(seed)
  const shape = {
    low:      { mood: [3.6, 4.4], sleep: [6.8, 7.8], risk: [0.08, 0.22], crisis: [0, 0.08],  div: [0.02, 0.10] },
    moderate: { mood: [2.6, 3.4], sleep: [5.8, 7.0], risk: [0.32, 0.52], crisis: [0, 0.22],  div: [0.10, 0.28] },
    high:     { mood: [1.8, 2.8], sleep: [4.4, 6.2], risk: [0.58, 0.76], crisis: [0.1, 0.45],div: [0.22, 0.45] },
    crisis:   { mood: [1.0, 2.0], sleep: [3.2, 5.2], risk: [0.78, 0.93], crisis: [0.5, 0.88],div: [0.35, 0.62] },
  }[riskLevel] || { mood: [3, 4], sleep: [6.5, 7.5], risk: [0.2, 0.35], crisis: [0, 0.1], div: [0.05, 0.15] }

  const pick = ([lo, hi]) => lo + rand() * (hi - lo)
  const EMOTIONS = { low: 'joy', moderate: 'sadness', high: 'sadness', crisis: 'fear' }
  const FACTORS = {
    low:      ['Sleep within personal baseline', 'Mood stable across 7 days', 'Activity consistent'],
    moderate: ['Sleep 18% below personal baseline', 'Mood variance rising', 'Reduced step count'],
    high:     ['Sleep 32% below personal baseline', 'Mood-sentiment divergence rising (suppression)', 'Crisis probability elevated (suicidality classifier)'],
    crisis:   ['Crisis probability elevated (suicidality classifier)', 'Sleep 45% below personal baseline', 'Sharp HRV drop vs baseline'],
  }

  const logs = []
  // Every other day for 30 days — a realistic adherence pattern, not perfect.
  for (let d = 29; d >= 0; d -= 2) {
    const when = new Date(Date.now() - d * 86400000)
    when.setHours(20, Math.floor(rand() * 59), 0, 0)
    // Gentle drift toward the stated level as the window approaches today.
    const drift = (29 - d) / 29
    const mood = Math.max(1, Math.min(5, Math.round(pick(shape.mood) - drift * 0.4)))
    const iso = when.toISOString()
    logs.push({
      uid,
      date: iso,
      createdAt: iso,
      moodScore: mood,
      energyLevel:  Math.max(1, Math.min(10, Math.round(mood * 2))),
      anxietyLevel: Math.max(1, Math.min(10, Math.round(11 - mood * 2))),
      sleepHours: round(pick(shape.sleep), 1),
      journalText: '',                       // seeded rows carry no journal text
      journalLanguage: 'en',
      symptoms: [],
      nlpResults: {
        sentimentScore:    round(pick([0.3, 0.85])),
        sentimentLabel:    mood >= 4 ? 'positive' : mood <= 2 ? 'negative' : 'neutral',
        emotionLabel:      EMOTIONS[riskLevel] || 'neutral',
        emotionConfidence: round(pick([0.55, 0.92])),
        crisisProbability: round(pick(shape.crisis), 3),
        detectedLanguage:  'en',
      },
      moodSentimentDivergence: round(pick(shape.div), 3),
      cycleDay: 0,
      cycleVulnerability: 0,
      riskScore: round(pick(shape.risk), 3),
      riskLevel,
      topFactors: FACTORS[riskLevel] || FACTORS.moderate,
      syncedToFirestore: true,
      seeded: true,
    })
  }
  return logs
}

function buildAssessments(uid, riskLevel, seed) {
  const rand = rng(seed + 'assess')
  const band = { low: [3, 6], moderate: [9, 13], high: [15, 19], crisis: [20, 25] }[riskLevel] || [8, 12]
  const out = []
  ;[28, 14, 2].forEach((daysAgo, i) => {
    const when = new Date(Date.now() - daysAgo * 86400000).toISOString()
    const base = Math.round(band[0] + rand() * (band[1] - band[0])) + i  // worsens over time
    const phq = Math.max(0, Math.min(27, base))
    out.push({
      uid, type: 'phq9', score: phq, maxScore: 27,
      severity: phq >= 20 ? 'severe' : phq >= 15 ? 'moderately severe' : phq >= 10 ? 'moderate' : phq >= 5 ? 'mild' : 'minimal',
      selfHarmFlag: riskLevel === 'crisis' && i === 2,
      answers: [], createdAt: when, seeded: true,
    })
    const gad = Math.max(0, Math.min(21, Math.round(phq * 0.72)))
    out.push({
      uid, type: 'gad7', score: gad, maxScore: 21,
      severity: gad >= 15 ? 'severe' : gad >= 10 ? 'moderate' : gad >= 5 ? 'mild' : 'minimal',
      answers: [], createdAt: when, seeded: true,
    })
  })
  return out
}

;(async () => {
  console.log(`\n=== Niranthara Firestore repair ${APPLY ? '(APPLYING)' : '(DRY RUN — pass --apply to write)'} ===\n`)

  // ── Locate the clinician ───────────────────────────────────────────────────
  const usersSnap = await db.collection('users').get()
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const clinicians = users.filter(u => u.role === 'clinician')
  if (!clinicians.length) {
    console.error('No clinician found. Run: node scripts/seedClinician.js first.')
    process.exit(1)
  }
  const CLIN = clinicians[0]
  console.log(`Clinician: ${CLIN.name} (${CLIN.id})\n`)

  const batchOps = []
  const commit = async (ref, data, merge = true) => {
    if (APPLY) batchOps.push({ ref, data, merge })
  }

  // ── 1. Orphan / duplicate patients ─────────────────────────────────────────
  // Demo patients are deliberately Firestore-only display records — they are
  // never signed into, so "no Auth user" alone does not make a doc junk. A doc
  // is junk only when it ALSO points at a clinician that does not exist: it can
  // never be signed into AND can never appear in anybody's caseload.
  console.log('1. Orphan and duplicate patient docs')
  const { auth } = require('../config/firebase')
  const clinicianIds = new Set(clinicians.map(c => c.id))
  const orphans = new Set()
  for (const u of users) {
    if (u.role === 'clinician') continue
    const danglingClinician = u.assignedClinician && !clinicianIds.has(u.assignedClinician)
    if (!danglingClinician) continue

    let hasAuth = true
    try { await auth.getUser(u.id) } catch { hasAuth = false }

    if (!hasAuth) {
      orphans.add(u.id)
      note(`${u.id} (${u.name}) — no Auth user AND clinician "${u.assignedClinician}" does not exist → unreachable duplicate, deleting`)
      if (APPLY) await db.collection('users').doc(u.id).delete()
    } else {
      note(`${u.id} (${u.name}) assigned to non-existent clinician "${u.assignedClinician}" → reassigning to ${CLIN.id}`)
      await commit(db.collection('users').doc(u.id), { assignedClinician: CLIN.id, updatedAt: new Date().toISOString() })
    }
  }

  // ── 2. gender / tracksCycle backfill ───────────────────────────────────────
  console.log('\n2. gender / tracksCycle backfill')
  for (const u of users) {
    if (u.role === 'clinician' || orphans.has(u.id)) continue
    if (u.gender && typeof u.tracksCycle === 'boolean') continue
    // Derive only from an explicit legacy persona field, never from a name.
    // Onboarding wrote `persona` while everything read `personaType`, so both
    // spellings have to be consulted here.
    const legacy = u.personaType || u.persona
    const female = legacy === 'women'
    const male   = legacy === 'men'
    const gender = u.gender || (female ? 'female' : male ? 'male' : 'prefer_not_to_say')
    const tracks = typeof u.tracksCycle === 'boolean' ? u.tracksCycle : female
    note(`${u.id} (${u.name || 'unnamed'}) → gender=${gender} tracksCycle=${tracks}`)
    await commit(db.collection('users').doc(u.id), {
      gender, tracksCycle: tracks,
      personaType: (legacy === 'men' || legacy === 'women') ? 'general' : (legacy || 'general'),
      updatedAt: new Date().toISOString(),
    })
  }

  // ── 3. Alerts missing clinicianUid ─────────────────────────────────────────
  console.log('\n3. clinicianAlerts missing clinicianUid')
  const alertsSnap = await db.collection('clinicianAlerts').get()
  let fixedAlerts = 0
  for (const doc of alertsSnap.docs) {
    const a = doc.data()
    if (a.clinicianUid) continue
    const owner = users.find(u => u.id === a.patientUid)?.assignedClinician || CLIN.id
    fixedAlerts++
    await commit(doc.ref, { clinicianUid: owner })
  }
  note(fixedAlerts ? `${fixedAlerts} alerts had no clinicianUid → set` : 'all alerts already carry clinicianUid')

  // ── 4. Backfill mood logs + assessments for hollow patients ────────────────
  console.log('\n4. Patients with no history (empty charts / SHAP / summary)')
  const patients = users.filter(u => u.role !== 'clinician' && !orphans.has(u.id))
  for (const p of patients) {
    // Never fabricate history on a real person's account. The whole point of
    // the primary-user story is that their numbers are genuinely theirs.
    if (p.id === LINK_ME) { console.log(`  · ${p.name || p.id}: REAL account — not seeding any synthetic data`); continue }

    const [moodSnap, assessSnap] = await Promise.all([
      db.collection('moodLogs').where('uid', '==', p.id).get(),
      db.collection('assessments').where('uid', '==', p.id).get(),
    ])
    if (moodSnap.size >= 5) { console.log(`  · ${p.name || p.id}: ${moodSnap.size} mood logs — leaving alone`); continue }

    const logs = buildMoodLogs(p.id, p.riskLevel || 'moderate', p.id)
    note(`${p.name || p.id}: ${moodSnap.size} → ${logs.length} mood logs (risk ${p.riskLevel || 'moderate'})`)
    logs.forEach((l, i) => commit(db.collection('moodLogs').doc(`seed_${p.id}_${i}`), l))

    if (assessSnap.size === 0) {
      const items = buildAssessments(p.id, p.riskLevel || 'moderate', p.id)
      note(`${p.name || p.id}: + ${items.length} PHQ-9/GAD-7 assessments`)
      items.forEach((a, i) => commit(db.collection('assessments').doc(`seed_${p.id}_${i}`), a))
    }

    // users.topFactors drives the dashboard SHAP panel.
    if (!p.topFactors?.length) {
      await commit(db.collection('users').doc(p.id), { topFactors: logs[logs.length - 1].topFactors })
    }
  }

  // ── 5. Link the real (self-registered) account into the caseload ───────────
  console.log('\n5. Real account linking')
  if (LINK_ME) {
    const target = users.find(u => u.id === LINK_ME)
    if (!target) {
      console.log(`  ! uid ${LINK_ME} not found in users`)
    } else {
      note(`${LINK_ME} → name="${LINK_NAME}", role=user, assignedClinician=${CLIN.id}`)
      await commit(db.collection('users').doc(LINK_ME), {
        name: LINK_NAME, role: 'user',
        assignedClinician: CLIN.id,
        profileComplete: true, onboardingComplete: true,
        updatedAt: new Date().toISOString(),
      })

      // Repair a corrupted period history. Tapping "log period" more than once
      // appended several starts on the same day (this account has two four
      // minutes apart), which the LSTM reads as 0-day cycles and then refuses
      // to train on. Collapse to one start per calendar day.
      const cycleDoc = await db.collection('cycleLogs').doc(LINK_ME).get()
      const history  = (cycleDoc.exists ? cycleDoc.data().periodHistory : target.periodHistory) || []
      const seen = new Set()
      const cleaned = history
        .map(d => (d?.toDate ? d.toDate().toISOString() : new Date(d).toISOString()))
        .filter(iso => { const k = iso.slice(0, 10); if (seen.has(k)) return false; seen.add(k); return true })
        .sort()
      if (cleaned.length !== history.length) {
        note(`${LINK_ME}: periodHistory ${history.length} → ${cleaned.length} entries (same-day duplicates removed)`)
        await commit(db.collection('cycleLogs').doc(LINK_ME), {
          uid: LINK_ME, periodHistory: cleaned,
          updatedAt: new Date().toISOString(),
        })
        await commit(db.collection('users').doc(LINK_ME), {
          periodHistory: cleaned,
          lastPeriodDate: cleaned[cleaned.length - 1] || null,
        })
      }
    }
  } else {
    const unlinked = patients.filter(u => !u.assignedClinician || !u.name)
    if (unlinked.length) {
      console.log('  ! These accounts will NOT appear in the clinician caseload:')
      unlinked.forEach(u => console.log(`      ${u.id}  name=${u.name || '(none)'}  assignedClinician=${u.assignedClinician || '(none)'}`))
      console.log(`    Fix with:  node scripts/repairAndSeedDemo.js --apply --link-me ${unlinked[0].id} "Your Name"`)
    } else {
      console.log('  · every patient account is named and assigned')
    }
  }

  // ── Commit ─────────────────────────────────────────────────────────────────
  if (APPLY && batchOps.length) {
    console.log(`\nCommitting ${batchOps.length} writes…`)
    for (let i = 0; i < batchOps.length; i += 400) {
      const batch = db.batch()
      batchOps.slice(i, i + 400).forEach(({ ref, data, merge }) => batch.set(ref, data, { merge }))
      await batch.commit()
    }
    console.log('Done.')
  } else if (!APPLY) {
    console.log(`\n${changes.length} change(s) would be made. Re-run with --apply to write them.`)
  } else {
    console.log('\nNothing to change.')
  }
  process.exit(0)
})().catch(e => { console.error('FAILED:', e); process.exit(1) })
