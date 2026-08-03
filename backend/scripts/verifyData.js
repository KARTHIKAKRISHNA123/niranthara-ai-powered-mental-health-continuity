// backend/scripts/verifyData.js
// "Is everyone's data actually in the database?" — answered per user, per feature.
//
//   node scripts/verifyData.js                 # everyone
//   node scripts/verifyData.js <uid>           # one person, with detail
//   node scripts/verifyData.js --watch         # re-check every 10s (demo rehearsal)
//
// Read-only. Never writes.

const { db } = require('../config/firebase')

const ARG   = process.argv[2]
const WATCH = process.argv.includes('--watch')
const UID   = ARG && !ARG.startsWith('--') ? ARG : null

const ago = (iso) => {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}
const newest = (rows, field = 'createdAt') =>
  rows.map(r => r[field]).filter(Boolean).sort().pop() || null

async function byUid(col, uid, field = 'uid') {
  try {
    const snap = await db.collection(col).where(field, '==', uid).get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.warn(`  ! ${col} read failed: ${e.message}`)
    return []
  }
}

async function report() {
  const usersSnap = await db.collection('users').get()
  let users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (UID) users = users.filter(u => u.id === UID)
  if (!users.length) { console.error(`No user matching ${UID || '(any)'}`); process.exit(1) }

  console.log(`\n${'='.repeat(96)}`)
  console.log(`NIRANTHARA DATA VERIFICATION  ·  ${new Date().toLocaleString('en-IN')}`)
  console.log('='.repeat(96))

  for (const u of users.sort((a, b) => (a.role === 'clinician' ? -1 : 1))) {
    if (u.role === 'clinician') {
      const alerts = await byUid('clinicianAlerts', u.id, 'clinicianUid')
      console.log(`\nCLINICIAN  ${u.name}  (${u.id})`)
      console.log(`  alerts owned: ${alerts.length}  ·  unresolved: ${alerts.filter(a => a.resolved === false).length}`)
      continue
    }

    const [moods, assess, alerts, chats, passive, bios, dayLogs, jitai] = await Promise.all([
      byUid('moodLogs', u.id), byUid('assessments', u.id),
      byUid('clinicianAlerts', u.id, 'patientUid'), byUid('chatLogs', u.id),
      byUid('passiveLogs', u.id), byUid('biometricLogs', u.id),
      byUid('cycleDayLogs', u.id), byUid('jitaiLogs', u.id),
    ])
    const cycleDoc = await db.collection('cycleLogs').doc(u.id).get()
    const ghDoc    = await db.collection('googleHealthTokens').doc(u.id).get()

    const ok = (n) => (n > 0 ? 'YES' : ' no')
    console.log(`\nPATIENT  ${u.name || '(unnamed)'}  (${u.id})`)
    console.log(`  profile      gender=${u.gender || '—'}  tracksCycle=${u.tracksCycle}  persona=${u.personaType || '—'}  onboarded=${!!u.onboardingComplete}`)
    console.log(`  clinician    ${u.assignedClinician || 'NOT ASSIGNED — invisible to the dashboard'}`)
    console.log(`  risk         ${u.riskLevel || '—'} / ${u.riskScore ?? '—'}   topFactors=${(u.topFactors || []).length}`)
    console.log(`  ${ok(moods.length)}  moodLogs        ${String(moods.length).padStart(3)}   latest ${ago(newest(moods))}`)
    console.log(`  ${ok(assess.length)}  assessments     ${String(assess.length).padStart(3)}   latest ${ago(newest(assess))}`)
    console.log(`  ${ok(chats.length)}  chatLogs        ${String(chats.length).padStart(3)}   latest ${ago(newest(chats, 'timestamp'))}`)
    console.log(`  ${ok(alerts.length)}  alerts          ${String(alerts.length).padStart(3)}   unresolved ${alerts.filter(a => a.resolved === false).length}`)
    console.log(`  ${ok(bios.length)}  biometricLogs   ${String(bios.length).padStart(3)}   latest ${ago(newest(bios))}`)
    console.log(`  ${ok(passive.length)}  passiveLogs     ${String(passive.length).padStart(3)}`)
    console.log(`  ${ok(jitai.length)}  jitaiLogs       ${String(jitai.length).padStart(3)}`)
    if (u.tracksCycle) {
      const h = cycleDoc.exists ? (cycleDoc.data().periodHistory || []).length : 0
      console.log(`  ${ok(h)}  cycle history   ${String(h).padStart(3)} periods   dayLogs ${dayLogs.length}`)
    }

    // ── Wearable link: exactly what "is my watch connected?" means ──
    if (ghDoc.exists && ghDoc.data().refreshTokenEnc) {
      const last = bios.filter(b => b.source === 'google_health').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      console.log(`  YES  Google Health CONNECTED (since ${ago(ghDoc.data().connectedAt)})`)
      if (last) {
        console.log(`       last real sync ${ago(last.createdAt)} — HR ${last.heartRate ?? '—'}  HRV ${last.hrv ?? '—'}  steps ${last.steps ?? '—'}  sleep ${last.sleepHours ?? '—'}h`)
        console.log(`       stress score ${last.physiologicalStressScore} from ${last.signalCount} signal(s)`)
      } else {
        console.log(`       no google_health reading stored yet — press Sync on the phone`)
      }
    } else {
      console.log(`   no  Google Health not connected — see docs/REAL_WEARABLE_SETUP.md`)
    }

    // Anything the mobile app queued offline and never delivered is invisible
    // here by definition; flag the symptom so it is not mistaken for "no data".
    const stale = moods.filter(m => m.syncedToFirestore === false).length
    if (stale) console.log(`  !!   ${stale} moodLogs marked unsynced`)
  }

  if (UID) {
    console.log(`\n${'-'.repeat(96)}`)
    console.log('Detail for the most recent mood log:')
    const m = (await byUid('moodLogs', UID)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    if (!m) console.log('  (none)')
    else console.log(JSON.stringify({
      createdAt: m.createdAt, moodScore: m.moodScore, sleepHours: m.sleepHours,
      riskScore: m.riskScore, riskLevel: m.riskLevel,
      crisisProbability: m.nlpResults?.crisisProbability,
      emotion: m.nlpResults?.emotionLabel,
      divergence: m.moodSentimentDivergence,
      journalEncrypted: !!m.journalText && m.journalText.includes(':'),
      topFactors: m.topFactors,
    }, null, 2))
  }
  console.log()
}

;(async () => {
  await report()
  if (WATCH) setInterval(report, 10000)
  else process.exit(0)
})().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
