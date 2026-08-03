// services/googleHealthClient.js
// Cloud read path for wearable data — Google Health API (health.googleapis.com/v4).
//
// WHY THIS EXISTS ALONGSIDE HealthConnectService.js:
//   Health Connect is an on-device Android API. It needs a native module and
//   therefore a custom dev build — it returns simulated data in Expo Go, so a
//   real Fitbit Charge 6 can never reach the pipeline during Expo Go testing.
//   The Google Health API is a server-to-server REST API: the phone only has to
//   complete an OAuth consent, and the backend pulls the data. That works in
//   Expo Go, on iOS, and from the clinician dashboard.
//
// WHY NOT THE FITBIT WEB API:
//   Google is decommissioning the legacy Fitbit Web API on 30 September 2026.
//   Building on it now would buy under two months of life. The Google Health
//   API is its replacement and already serves Fitbit device data.
//   https://developers.google.com/health/migration
//
// Tokens: the refresh token is AES-256-GCM encrypted with the same key as
// journal text before it touches Firestore. It is never returned to a client.

const { db } = require('../config/firebase')
const { encrypt, decrypt } = require('../utils/encryption')

const HEALTH_BASE  = 'https://health.googleapis.com/v4'
const OAUTH_AUTH   = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN  = 'https://oauth2.googleapis.com/token'

// Only the scopes the risk model actually consumes. Requesting more would fail
// Google's verification review for no benefit.
const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
]

const CLIENT_ID     = process.env.GOOGLE_HEALTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_HEALTH_CLIENT_SECRET
const REDIRECT_URI  = process.env.GOOGLE_HEALTH_REDIRECT_URI

const isConfigured = () => Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI)

// ── OAuth ────────────────────────────────────────────────────────────────────

function buildConsentUrl(state) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES.join(' '),
    access_type:   'offline',   // required to receive a refresh token
    prompt:        'consent',   // force refresh token even on re-consent
    include_granted_scopes: 'true',
    state,
  })
  return `${OAUTH_AUTH}?${params.toString()}`
}

async function exchangeCode(code) {
  const res = await fetch(OAUTH_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description || json.error || 'Token exchange failed')
  return json // { access_token, refresh_token, expires_in, scope }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(OAUTH_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description || json.error || 'Token refresh failed')
  return json
}

// ── Token storage ────────────────────────────────────────────────────────────

async function saveTokens(uid, tokens, grantedScope) {
  await db.collection('googleHealthTokens').doc(uid).set({
    uid,
    refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    scope:           grantedScope || tokens.scope || '',
    connectedAt:     new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
  }, { merge: true })
}

async function getAccessToken(uid) {
  const doc = await db.collection('googleHealthTokens').doc(uid).get()
  if (!doc.exists || !doc.data().refreshTokenEnc) {
    const err = new Error('Google Health is not connected for this account')
    err.code = 'NOT_CONNECTED'
    throw err
  }
  const refreshToken = decrypt(doc.data().refreshTokenEnc)
  const fresh = await refreshAccessToken(refreshToken)
  return fresh.access_token
}

async function disconnect(uid) {
  await db.collection('googleHealthTokens').doc(uid).delete()
}

async function isConnected(uid) {
  const doc = await db.collection('googleHealthTokens').doc(uid).get()
  return doc.exists && Boolean(doc.data().refreshTokenEnc)
}

// ── Data reads ───────────────────────────────────────────────────────────────

async function listDataPoints(accessToken, dataType) {
  // NO server-side time filter, deliberately.
  //
  // The obvious `filter: startTime >= "..." AND endTime <= "..."` returns
  // HTTP 400 INVALID_DATA_POINT_FILTER_RESTRICTION_COMPARABLE for every data
  // type, because there IS no top-level startTime on a v4 data point — each
  // type nests its own timestamp (heartRate.sampleTime.physicalTime,
  // sleep.interval.startTime, dailyRestingHeartRate.date, ...). That 400 was
  // thrown, swallowed by a .catch(() => null) upstream, and surfaced as
  // "no records" while the account had plenty. Points come back newest-first,
  // so we page a slice and window it in JS instead.
  const params = new URLSearchParams({ page_size: '1000' })
  const url = `${HEALTH_BASE}/users/me/dataTypes/${dataType}/dataPoints?${params}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (res.status === 403 || res.status === 404) {
    // Scope not granted, or this device never wrote this type. Both mean
    // "absent", which must stay null — a 0 here would score as maximum
    // deviation and fire a false alert.
    return null
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Health ${dataType} read failed (${res.status}): ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.dataPoints || json.dataPoint || []
}

// Each v4 data type has its OWN payload key, its OWN timestamp location, and
// — for heart rate — numbers encoded as STRINGS. A generic "find any numeric
// leaf" walker silently returned null for all of them, which is why real Fitbit
// data rendered as em-dashes. Verified against a Charge 6 on 2 Aug 2026:
//
//   heart-rate               heartRate.sampleTime.physicalTime  · beatsPerMinute "75"
//   heart-rate-variability   heartRateVariability.sampleTime…   · rootMeanSquareOfSuccessiveDifferencesMilliseconds 58.4
//   daily-resting-heart-rate dailyRestingHeartRate.date{y,m,d}  · beatsPerMinute "76"
//   sleep                    sleep.interval.startTime/endTime
//
const num = (x) => {
  const n = typeof x === 'string' ? Number(x) : x
  return Number.isFinite(n) ? n : null
}
const civilDate = (d) =>
  d && d.year ? new Date(Date.UTC(d.year, (d.month || 1) - 1, d.day || 1)).toISOString() : null

// Returns { t: ISO string | null, v: number | null } for one point.
const EXTRACTORS = {
  'heart-rate': (p) => ({
    t: p.heartRate?.sampleTime?.physicalTime ?? null,
    v: num(p.heartRate?.beatsPerMinute),
  }),
  'heart-rate-variability': (p) => ({
    t: p.heartRateVariability?.sampleTime?.physicalTime ?? null,
    v: num(p.heartRateVariability?.rootMeanSquareOfSuccessiveDifferencesMilliseconds),
  }),
  'daily-resting-heart-rate': (p) => ({
    t: civilDate(p.dailyRestingHeartRate?.date),
    v: num(p.dailyRestingHeartRate?.beatsPerMinute),
  }),
  // This account returned zero step points, so the payload shape is unverified.
  // Every candidate path is tried and it stays null if none match — null is the
  // correct answer for an absent signal, and never 0.
  'steps': (p) => {
    const s = p.steps || {}
    return {
      t: s.interval?.startTime ?? s.sampleTime?.physicalTime ?? civilDate(s.date),
      v: num(s.count ?? s.steps ?? s.value),
    }
  },
  'sleep': (p) => {
    const iv = p.sleep?.interval
    if (!iv?.startTime || !iv?.endTime) return { t: null, v: null }
    return { t: iv.startTime, v: (new Date(iv.endTime) - new Date(iv.startTime)) / 3.6e6 }
  },
}

const deviceOf = (p) => p?.dataSource?.device?.displayName || p?.dataSource?.platform || 'unknown'

/**
 * Keep points from ONE source only.
 *
 * Google Health aggregates every writer, and a single user commonly has three
 * for steps: the watch ("Charge 6"), Fitbit's phone-based MobileTrack, and
 * Health Connect. Summing them triple-counts — a real 129-step morning was
 * reported as 909. Prefer the wearable, since that is the number on the
 * patient's wrist and the one they will check us against.
 */
function preferSingleSource(points) {
  if (!Array.isArray(points) || !points.length) return points || []
  const groups = new Map()
  for (const p of points) {
    const k = deviceOf(p)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(p)
  }
  if (groups.size <= 1) return points
  const keys = [...groups.keys()]
  // A named wearable beats a phone tracker or a generic aggregator.
  const wearable = keys.find(k => !/mobiletrack|health_?connect|phone|unknown/i.test(k))
  return groups.get(wearable || keys[0])
}

/** Extract {t,v} pairs inside the window. Absent stays absent. */
function windowed(points, dataType, sinceMs, { singleSource = false } = {}) {
  const ex = EXTRACTORS[dataType]
  if (!ex || !Array.isArray(points)) return []
  const src = singleSource ? preferSingleSource(points) : points
  return src
    .map(ex)
    .filter(r => r.v != null && r.t && new Date(r.t).getTime() >= sinceMs)
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/**
 * Fetch the last `windowHours` of biometrics and normalise to exactly the shape
 * POST /api/passive/biometric-sync already accepts, so the downstream scoring,
 * alerting and dashboard path is unchanged.
 */
async function fetchBiometrics(uid, windowHours = 24) {
  const accessToken = await getAccessToken(uid)
  const end   = new Date()
  const start = new Date(end.getTime() - windowHours * 3600 * 1000)
  const [s, e] = [start.toISOString(), end.toISOString()]

  // A read that FAILS must be distinguishable from a signal that is genuinely
  // absent, so log the reason instead of collapsing both to null in silence —
  // that silence is what hid a 400 on every request.
  const read = (type) =>
    listDataPoints(accessToken, type).catch((err) => {
      console.warn(`[googleHealth] ${type} read failed: ${err.message}`)
      return null
    })

  const [hr, hrv, restingHr, steps, sleep] = await Promise.all([
    read('heart-rate'),
    read('heart-rate-variability'),
    read('daily-resting-heart-rate'),
    read('steps'),
    read('sleep'),
  ])

  // ── Per-signal windows. One shared window is wrong for every signal here.
  //
  // Steps summed over a rolling 24h spans two calendar days, so the card read
  // 0.4k while the watch face — which counts from local midnight — showed 129.
  // A patient comparing the two sees the app as broken, and they are right to.
  // Sleep and HRV have the opposite problem: both are produced once a night, so
  // a 24h window frequently contains neither and renders as "—".
  const vals = (points, type, sinceMs, opts) => windowed(points, type, sinceMs, opts).map(r => r.v)

  const localMidnight = new Date()
  localMidnight.setHours(0, 0, 0, 0)
  const SINCE = {
    live:  start.getTime(),                            // HR — the requested window
    today: localMidnight.getTime(),                    // steps — match the watch face
    night: end.getTime() - 36 * 3600 * 1000,           // HRV — produced overnight
    sleep: end.getTime() - 48 * 3600 * 1000,           // most recent night, not always last night
    daily: end.getTime() - 48 * 3600 * 1000,           // resting HR — daily aggregate
  }

  const hrVals   = vals(hr,        'heart-rate',              SINCE.live)
  const hrvVals  = vals(hrv,       'heart-rate-variability',  SINCE.night)
  const restVals = vals(restingHr, 'daily-resting-heart-rate', SINCE.daily)
  // singleSource: steps are the one signal several writers duplicate.
  const stepVals = vals(steps,     'steps',                   SINCE.today, { singleSource: true })

  // Most recent night only — totalling several nights produced "28.6h slept".
  const sleepVals  = vals(sleep, 'sleep', SINCE.sleep, { singleSource: true })
  const sleepHours = sleepVals.length ? sleepVals[0] : null

  const totalSteps = stepVals.length ? stepVals.reduce((a, b) => a + b, 0) : null

  return {
    source:           'google_health',
    isReal:           true,
    provider:         'Google Health',
    fetchedAt:        end.toISOString(),
    windowHours,
    heartRate:        hrVals.length   ? Math.round(mean(hrVals))            : null,
    // Google returns points NEWEST-FIRST, so the most recent reading is [0].
    // Taking [length-1] here silently reported the oldest value in the window.
    restingHeartRate: restVals.length ? Math.round(restVals[0]) : (hrVals.length ? Math.round(mean(hrVals)) : null),
    hrv:              hrvVals.length  ? Math.round(hrvVals[0]) : null,
    steps:            totalSteps != null ? Math.round(totalSteps) : null,
    sleepHours:       sleepHours != null ? Math.round(sleepHours * 10) / 10 : null,
    // Which signals the account actually granted + the device actually wrote —
    // surfaced so the UI can say "HRV: —" honestly instead of implying zero.
    availability: {
      heartRate:  hrVals.length > 0,
      hrv:        hrvVals.length > 0,
      steps:      stepVals.length > 0,
      sleep:      Array.isArray(sleep) && sleep.length > 0,
    },
  }
}

module.exports = {
  isConfigured,
  buildConsentUrl,
  exchangeCode,
  saveTokens,
  getAccessToken,
  fetchBiometrics,
  isConnected,
  disconnect,
  SCOPES,
}
