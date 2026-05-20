// smartwatch/utils/healthApiClient.js
// Google Fitness REST API fetch utility with auto-token refresh
// All 7 biometric signals relevant to Niranthara's XGBoost + LSTM ML pipeline

require('dotenv').config()
const axios   = require('axios')
const crypto  = require('crypto')
const { db }  = require('../config/firebase')

const GOOGLE_TOKEN_URL   = 'https://oauth2.googleapis.com/token'
const FITNESS_API_BASE   = 'https://www.googleapis.com/fitness/v1/users/me'

// ── AES-256-GCM decrypt (mirrors backend/utils/encryption.js) ────────────────
const getKey = () => Buffer.from(process.env.ENCRYPTION_KEY, 'hex')

const decrypt = (data) => {
  if (!data) return ''
  try {
    const [ivH, tagH, encH] = data.split(':')
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivH, 'hex'))
    decipher.setAuthTag(Buffer.from(tagH, 'hex'))
    return Buffer.concat([
      decipher.update(Buffer.from(encH, 'hex')),
      decipher.final()
    ]).toString('utf8')
  } catch {
    return ''
  }
}

const encrypt = (text) => {
  if (!text) return ''
  const iv     = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

// ── Token refresh ─────────────────────────────────────────────────────────────
const refreshAccessToken = async (uid, encryptedRefreshToken) => {
  const refreshToken = decrypt(encryptedRefreshToken)
  if (!refreshToken) throw new Error(`No valid refresh token for uid=${uid}`)

  const res = await axios.post(GOOGLE_TOKEN_URL, new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type:    'refresh_token'
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })

  const { access_token, expires_in } = res.data
  const newExpiresAt = Date.now() + (expires_in * 1000)

  // Persist refreshed token back to Firestore (encrypted)
  await db.collection('users').doc(uid).update({
    'googleHealthTokens.accessToken': encrypt(access_token),
    'googleHealthTokens.expiresAt':   newExpiresAt,
    updatedAt: new Date().toISOString()
  })

  console.log(`[BiometricSync] token-refresh: refreshed for uid=${uid} at ${new Date().toISOString()}`)
  return access_token
}

// ── Get valid access token (refresh if expired) ───────────────────────────────
const getAccessToken = async (uid, tokens) => {
  if (tokens.expiresAt && Date.now() < tokens.expiresAt - 60000) {
    // Token still valid (with 60s buffer)
    return decrypt(tokens.accessToken)
  }
  return refreshAccessToken(uid, tokens.refreshToken)
}

// ── Fitness data fetch helper ─────────────────────────────────────────────────
// Google Fitness API uses nanosecond timestamps for time ranges
const getNanoTimestamp = (date) => (date.getTime() * 1_000_000).toString()

const fetchDataset = async (accessToken, dataTypeName, startMs, endMs) => {
  const startNs = getNanoTimestamp(new Date(startMs))
  const endNs   = getNanoTimestamp(new Date(endMs))
  const datasetId = `${startNs}-${endNs}`

  try {
    const res = await axios.get(
      `${FITNESS_API_BASE}/dataSources/${dataTypeName}/datasets/${datasetId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    return res.data.point || []
  } catch (err) {
    console.warn(`[BiometricSync] fetch-warn: ${dataTypeName} unavailable for user — ${err.message}`)
    return []
  }
}

// ── Aggregate helpers ─────────────────────────────────────────────────────────
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
const sum = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) : null

const extractFpValues = (points) =>
  points.flatMap(p => p.value?.map(v => v.fpVal || 0)).filter(v => v > 0)

const extractIntValues = (points) =>
  points.flatMap(p => p.value?.map(v => v.intVal || 0)).filter(v => v > 0)

// ── Main biometric fetch ──────────────────────────────────────────────────────
/**
 * Fetches all 7 biometric signals for a user for the last 24 hours.
 * Returns null if the user's token is invalid.
 */
const fetchBiometrics = async (uid, tokens) => {
  let accessToken
  try {
    accessToken = await getAccessToken(uid, tokens)
  } catch (err) {
    console.error(`[BiometricSync] token-error: uid=${uid} — ${err.message} at ${new Date().toISOString()}`)
    return null
  }

  const endMs   = Date.now()
  const startMs = endMs - (24 * 60 * 60 * 1000) // Last 24 hours

  // Fetch all 7 data types in parallel
  const [
    hrvPoints,
    rhrPoints,
    intradayHrPoints,
    sleepPoints,
    activeMinutesPoints,
    tempPoints,
    respiratoryPoints
  ] = await Promise.all([
    fetchDataset(accessToken, 'derived:com.google.heart_rate.variability:com.google.android.gms:merge_heart_rate_variability', startMs, endMs),
    fetchDataset(accessToken, 'derived:com.google.resting_heart_rate:com.google.android.gms:computed', startMs, endMs),
    fetchDataset(accessToken, 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm', startMs, endMs),
    fetchDataset(accessToken, 'derived:com.google.sleep.segment:com.google.android.gms:merged', startMs, endMs),
    fetchDataset(accessToken, 'derived:com.google.active_minutes:com.google.android.gms:merge_active_minutes', startMs, endMs),
    fetchDataset(accessToken, 'derived:com.google.body.temperature:com.google.android.gms:merged', startMs, endMs),
    fetchDataset(accessToken, 'derived:com.google.respiratory_rate:com.google.android.gms:merged', startMs, endMs)
  ])

  // ── Process HRV ─────────────────────────────────────────────────────────────
  const hrv = avg(extractFpValues(hrvPoints))

  // ── Process RHR ─────────────────────────────────────────────────────────────
  const rhr = avg(extractFpValues(rhrPoints))

  // ── Process Intraday HR → Cardiac Stress Score ───────────────────────────
  // Cardiac stress = proportion of readings above 100 bpm during non-active periods
  const hrValues = extractFpValues(intradayHrPoints)
  const elevatedReadings = hrValues.filter(v => v > 100).length
  const cardiacStressRatio = hrValues.length > 0 ? elevatedReadings / hrValues.length : null

  // ── Process Sleep Stages → Sleep Quality Score ────────────────────────────
  // Sleep stage types: 1=awake, 2=sleep, 3=out-of-bed, 4=light, 5=deep, 6=REM
  let deepMinutes = 0, remMinutes = 0, lightMinutes = 0, awakeMinutes = 0
  for (const point of sleepPoints) {
    const type = point.value?.[0]?.intVal
    const startNs = parseInt(point.startTimeNanos || '0')
    const endNs   = parseInt(point.endTimeNanos   || '0')
    const mins    = (endNs - startNs) / 1_000_000 / 60_000
    if (type === 5) deepMinutes  += mins
    else if (type === 6) remMinutes  += mins
    else if (type === 4) lightMinutes += mins
    else if (type === 1) awakeMinutes += mins
  }
  const totalSleepMinutes = deepMinutes + remMinutes + lightMinutes
  // Quality score: weighted sum (deep=3x, REM=2x, light=1x) / total — 0 to 1 range
  const sleepQualityRaw = totalSleepMinutes > 0
    ? (deepMinutes * 3 + remMinutes * 2 + lightMinutes) / (totalSleepMinutes * 3)
    : null

  // ── Process Active Minutes ────────────────────────────────────────────────
  const activeMinutes = sum(extractIntValues(activeMinutesPoints))

  // ── Process Basal Body Temperature ───────────────────────────────────────
  const basalTemp = avg(extractFpValues(tempPoints))

  // ── Process Respiratory Rate ──────────────────────────────────────────────
  const respiratoryRate = avg(extractFpValues(respiratoryPoints))

  return {
    hrv,
    rhr,
    cardiacStressRatio,
    sleepQualityScore: sleepQualityRaw,
    deepMinutes:       Math.round(deepMinutes),
    remMinutes:        Math.round(remMinutes),
    lightMinutes:      Math.round(lightMinutes),
    awakeMinutes:      Math.round(awakeMinutes),
    totalSleepHours:   parseFloat((totalSleepMinutes / 60).toFixed(2)),
    activeMinutes:     activeMinutes || 0,
    basalTemp,
    respiratoryRate
  }
}

module.exports = { fetchBiometrics }
