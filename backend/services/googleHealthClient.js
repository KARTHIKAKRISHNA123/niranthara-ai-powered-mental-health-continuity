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

async function listDataPoints(accessToken, dataType, startTime, endTime) {
  // The list endpoint returns intraday points for a time range.
  const params = new URLSearchParams({
    page_size: '1000',
    filter: `startTime >= "${startTime}" AND endTime <= "${endTime}"`,
  })
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

// Response shapes vary per data type; pull the first numeric leaf we recognise
// rather than assuming one field name.
function numericValue(point) {
  if (point == null) return null
  const v = point.value ?? point
  if (typeof v === 'number') return v
  for (const k of [
    'beatsPerMinute', 'bpm', 'count', 'steps',
    'milliseconds', 'millis', 'rmssd', 'value', 'doubleValue', 'intValue',
  ]) {
    if (typeof v?.[k] === 'number') return v[k]
  }
  return null
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

  const [hr, hrv, restingHr, steps, sleep] = await Promise.all([
    listDataPoints(accessToken, 'heart-rate', s, e).catch(() => null),
    listDataPoints(accessToken, 'heart-rate-variability', s, e).catch(() => null),
    listDataPoints(accessToken, 'daily-resting-heart-rate', s, e).catch(() => null),
    listDataPoints(accessToken, 'steps', s, e).catch(() => null),
    listDataPoints(accessToken, 'sleep', s, e).catch(() => null),
  ])

  const nums = (arr) => (arr || []).map(numericValue).filter(n => n != null)

  const hrVals   = nums(hr)
  const hrvVals  = nums(hrv)
  const restVals = nums(restingHr)
  const stepVals = nums(steps)

  // Sleep is a set of sessions; total the durations.
  const sleepHours = Array.isArray(sleep) && sleep.length
    ? sleep.reduce((sum, p) => {
        const st = p.startTime || p.start
        const en = p.endTime || p.end
        if (!st || !en) return sum
        return sum + (new Date(en) - new Date(st)) / 3.6e6
      }, 0)
    : null

  const totalSteps = stepVals.length ? stepVals.reduce((a, b) => a + b, 0) : null

  return {
    source:           'google_health',
    isReal:           true,
    provider:         'Google Health',
    fetchedAt:        end.toISOString(),
    windowHours,
    heartRate:        hrVals.length   ? Math.round(mean(hrVals))            : null,
    restingHeartRate: restVals.length ? Math.round(restVals[restVals.length - 1]) : (hrVals.length ? Math.round(mean(hrVals)) : null),
    hrv:              hrvVals.length  ? Math.round(hrvVals[hrvVals.length - 1]) : null,
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
