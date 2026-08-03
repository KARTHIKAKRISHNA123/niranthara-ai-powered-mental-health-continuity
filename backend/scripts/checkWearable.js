// backend/scripts/checkWearable.js
//
//   node scripts/checkWearable.js
//
// Answers one question before you walk on stage: is the wearable beat going to
// show REAL data or simulated data? Read-only, never writes.
//
// The distinction matters because `source: 'simulation'` and a real Google Health
// pull render identically in the app. Saying "this is my watch" over simulated
// numbers is the one thing in this demo that would be dishonest by accident.

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { db } = require('../config/firebase')

const mins = (iso) => Math.round((Date.now() - new Date(iso)) / 60000)

async function main() {
  console.log(`\nWEARABLE PRE-FLIGHT  ·  ${new Date().toLocaleTimeString()}\n${'-'.repeat(58)}`)

  // 1 — credentials in THIS script's env. Necessary but NOT sufficient: this is
  // a separate node process that just re-read .env, so it says nothing about
  // what the long-running server loaded at ITS boot. That distinction wasted
  // real time once — the file was correct while the server, started 28 minutes
  // earlier, had no credentials at all.
  const configured = Boolean(
    process.env.GOOGLE_HEALTH_CLIENT_ID &&
    process.env.GOOGLE_HEALTH_CLIENT_SECRET &&
    process.env.GOOGLE_HEALTH_REDIRECT_URI
  )
  console.log(`.env file has credentials : ${configured ? 'YES' : 'NO'}`)

  // 1b — the check that actually matters: has the RUNNING server loaded them?
  // Server uptime vs .env mtime is the tell, and needs no auth token.
  try {
    const r = await fetch('http://localhost:5000/api/health').then(x => x.json())
    const bootedAt = Date.now() - r.uptime * 1000
    const envAt = require('fs').statSync(path.join(__dirname, '..', '.env')).mtimeMs
    const stale = envAt > bootedAt
    console.log(`server booted             : ${new Date(bootedAt).toLocaleTimeString()}`)
    console.log(`.env last edited          : ${new Date(envAt).toLocaleTimeString()}`)
    console.log(`server has credentials    : ${stale
      ? 'NO  <-- .env changed AFTER boot. RESTART THE BACKEND.'
      : 'YES (env predates boot)'}`)
    if (stale) {
      console.log('    On Windows a restart silently fails if the old process still holds')
      console.log('    port 5000 — the new one dies on EADDRINUSE and the stale one keeps')
      console.log('    serving. Check with: netstat -ano | grep ":5000.*LISTENING"')
    }
  } catch {
    console.log('server booted             : backend not reachable on :5000')
  }
  if (configured) {
    const host = (process.env.GOOGLE_HEALTH_REDIRECT_URI.match(/\/\/([^/]+)/) || [])[1]
    console.log(`redirect host             : ${host}`)
    console.log(`  ^ this must EXACTLY match the Authorized redirect URI in Google Console.`)
    console.log(`    A restarted trycloudflare tunnel changes it and breaks OAuth.`)
  }

  // 2 — has anyone completed consent?
  const tokens = await db.collection('googleHealthTokens').get()
  console.log(`\ngoogleHealthTokens        : ${tokens.size} connected account(s)`)
  tokens.docs.forEach(d => console.log(`  - ${d.id}`))
  if (!tokens.size) console.log('  Nobody has completed OAuth. Tap "Connect Fitbit via Google Health".')

  // 3 — what did the last syncs actually contain?
  const snap = await db.collection('biometricLogs').get()
  const rows = snap.docs.map(d => d.data())
    .filter(r => r.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)

  console.log(`\nlast ${rows.length} biometric syncs:`)
  for (const r of rows) {
    const src = r.source || r.dataSource || 'unknown'
    const real = src !== 'simulation' && !String(src).startsWith('test') && !String(src).startsWith('rehearsal')
    console.log(
      `  ${mins(r.createdAt).toString().padStart(5)}m ago  ${real ? 'REAL      ' : 'simulated '}` +
      `src=${String(src).padEnd(16)} hr=${r.restingHeartRate ?? r.heartRate ?? '-'} ` +
      `hrv=${r.hrv ?? 'null'} steps=${r.steps ?? '-'} sleep=${r.sleepHours ?? '-'}`
    )
  }

  // 4 — the verdict you actually need
  const fresh = rows.filter(r => mins(r.createdAt) < 120)
  const realFresh = fresh.filter(r => {
    const s = r.source || r.dataSource || ''
    return s && s !== 'simulation' && !s.startsWith('test') && !s.startsWith('rehearsal')
  })

  console.log(`\n${'-'.repeat(58)}`)
  if (realFresh.length) {
    console.log('VERDICT: REAL wearable data in the last 2h. Say "this is my watch".')
  } else if (fresh.length) {
    console.log('VERDICT: only SIMULATED data. Say "simulated — same code path", never "my watch".')
  } else {
    console.log('VERDICT: no recent sync at all. Tap Sync before you go on stage.')
  }
  console.log()
  process.exit(0)
}

main().catch(e => { console.error(e.message); process.exit(1) })
