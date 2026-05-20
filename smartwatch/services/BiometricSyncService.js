// smartwatch/services/BiometricSyncService.js
// Core cloud-to-cloud sync: fetch biometrics → compute deviations → write Firestore → trigger JITAI/Crisis

require('dotenv').config()
const axios  = require('axios')
const { v4: uuidv4 } = require('uuid')
const { db } = require('../config/firebase')
const { fetchBiometrics } = require('../utils/healthApiClient')

const BACKEND_URL    = process.env.BACKEND_URL    || 'http://localhost:5000'
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// ── Personal baseline z-score deviation (matches baselineService.js pattern) ──
// deviation = clamp((baseline_mean - today_value) / baseline_std, 0, 1)
const deviationScore = (todayValue, mean, std) => {
  if (todayValue === null || !mean || !std) return 0.3 // default during calibration
  const z = (mean - todayValue) / Math.max(std, 0.01)
  return parseFloat(Math.min(Math.max(z / 3, 0), 1).toFixed(4))
}

// ── Fetch last 30 days of biometricLogs for baseline computation ──────────────
const computeBiometricBaseline = async (uid) => {
  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const snap = await db.collection('biometricLogs')
    .where('uid', '==', uid)
    .where('syncedAt', '>=', thirtyAgo.toISOString())
    .orderBy('syncedAt', 'desc')
    .limit(200)
    .get()

  const logs = snap.docs.map(d => d.data())
  if (logs.length < 5) return null // insufficient history for meaningful baseline

  const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const std  = arr => {
    if (arr.length < 2) return 1
    const m = mean(arr)
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) || 1
  }

  const hrv            = logs.map(l => l.hrv).filter(v => v > 0)
  const rhr            = logs.map(l => l.rhr).filter(v => v > 0)
  const cardiacStress  = logs.map(l => l.cardiacStressRatio).filter(v => v != null)
  const sleepQuality   = logs.map(l => l.sleepQualityScore).filter(v => v != null)
  const activeMinutes  = logs.map(l => l.activeMinutes).filter(v => v > 0)
  const respiratoryRate = logs.map(l => l.respiratoryRate).filter(v => v > 0)
  const basalTemp      = logs.map(l => l.basalTemp).filter(v => v > 0)

  return {
    hrv:             { mean: mean(hrv),           std: std(hrv) },
    rhr:             { mean: mean(rhr),           std: std(rhr) },
    cardiacStress:   { mean: mean(cardiacStress), std: std(cardiacStress) },
    sleepQuality:    { mean: mean(sleepQuality),  std: std(sleepQuality) },
    activeMinutes:   { mean: mean(activeMinutes), std: std(activeMinutes) },
    respiratoryRate: { mean: mean(respiratoryRate), std: std(respiratoryRate) },
    basalTemp:       { mean: mean(basalTemp),     std: std(basalTemp) }
  }
}

// ── Main sync function for a single user ──────────────────────────────────────
const syncUser = async (uid, googleHealthTokens) => {
  console.log(`[BiometricSync] sync-start: uid=${uid} at ${new Date().toISOString()}`)

  // 1. Fetch raw biometric data from Google Health API
  const biometrics = await fetchBiometrics(uid, googleHealthTokens)
  if (!biometrics) {
    console.warn(`[BiometricSync] sync-skip: no biometrics returned for uid=${uid}`)
    return false
  }

  // 2. Compute personal 30-day baselines
  const baseline = await computeBiometricBaseline(uid)

  // 3. Compute deviation scores (z-score normalized 0–1)
  const bl = baseline || {}
  const hrvDeviationScore       = deviationScore(biometrics.hrv,             bl.hrv?.mean,            bl.hrv?.std)
  const rhrDeviationScore       = deviationScore(biometrics.rhr === null ? null : -biometrics.rhr, // Higher RHR = worse
                                    bl.rhr ? -bl.rhr.mean : null, bl.rhr?.std)
  const cardiacStressScore      = deviationScore(biometrics.cardiacStressRatio, bl.cardiacStress?.mean, bl.cardiacStress?.std)
  const sleepQualityDeviation   = deviationScore(biometrics.sleepQualityScore,  bl.sleepQuality?.mean,  bl.sleepQuality?.std)
  const activityDeviationScore  = deviationScore(biometrics.activeMinutes,      bl.activeMinutes?.mean,  bl.activeMinutes?.std)
  const respiratoryDevScore     = deviationScore(biometrics.respiratoryRate,     bl.respiratoryRate?.mean, bl.respiratoryRate?.std)
  const basalTempDevScore       = deviationScore(biometrics.basalTemp,           bl.basalTemp?.mean,      bl.basalTemp?.std)

  // 4. Write to biometricLogs Firestore collection
  const offlineSyncId = uuidv4()
  const logDoc = {
    uid,
    offlineSyncId,
    syncedAt: new Date().toISOString(),
    dataSource: 'fitbit_google_health_api',

    // Raw values
    hrv:              biometrics.hrv,
    rhr:              biometrics.rhr,
    cardiacStressRatio: biometrics.cardiacStressRatio,
    sleepQualityScore:  biometrics.sleepQualityScore,
    deepMinutes:      biometrics.deepMinutes,
    remMinutes:       biometrics.remMinutes,
    lightMinutes:     biometrics.lightMinutes,
    awakeMinutes:     biometrics.awakeMinutes,
    totalSleepHours:  biometrics.totalSleepHours,
    activeMinutes:    biometrics.activeMinutes,
    basalTemp:        biometrics.basalTemp,
    respiratoryRate:  biometrics.respiratoryRate,

    // Deviation scores (0–1, personal baseline z-score)
    hrvDeviationScore,
    rhrDeviationScore,
    cardiacStressScore,
    sleepQualityDeviation,
    activityDeviationScore,
    respiratoryDevScore,
    basalTempDevScore
  }

  await db.collection('biometricLogs').doc(offlineSyncId).set(logDoc)
  await db.collection('users').doc(uid).update({
    lastBiometricSync: new Date().toISOString(),
    lastHrvDeviation:  hrvDeviationScore,
    fitbitConnected:   true
  })

  console.log(`[BiometricSync] sync-write: uid=${uid} hrv=${biometrics.hrv?.toFixed(1)} hrvDev=${hrvDeviationScore} at ${new Date().toISOString()}`)

  // 5. Trigger XGBoost risk model with augmented biometric features
  try {
    await axios.post(`${AI_SERVICE_URL}/api/predict/risk`, {
      uid,
      // Biometric augment features (supplementary to existing 14 features)
      hrv_deviation_score:     hrvDeviationScore,
      rhr_deviation_score:     rhrDeviationScore,
      cardiac_stress_score:    cardiacStressScore,
      sleep_quality_score:     biometrics.sleepQualityScore || 0,
      activity_deviation_score: activityDeviationScore,
      respiratory_dev_score:   respiratoryDevScore,
      basal_temp_dev_score:    basalTempDevScore
    }, { timeout: 10000 })
  } catch (err) {
    console.warn(`[BiometricSync] risk-predict-warn: uid=${uid} — ${err.message}`)
  }

  // 6. Crisis detection — HRV critically low + RHR elevated
  if (hrvDeviationScore > 0.4 && rhrDeviationScore > 0.3) {
    console.log(`[BiometricSync] crisis-trigger: uid=${uid} HRV critically low at ${new Date().toISOString()}`)
    try {
      const crisisRes = await axios.post(`${AI_SERVICE_URL}/api/crisis/detect`, {
        text: `Biometric stress signal: HRV critically low (deviation ${hrvDeviationScore.toFixed(2)}), RHR elevated (deviation ${rhrDeviationScore.toFixed(2)})`,
        uid
      }, { timeout: 10000 })

      const crisisProb = crisisRes.data?.crisisProbability || 0
      if (crisisProb > 0.6) {
        await db.collection('clinicianAlerts').add({
          uid,
          type:             'high_risk',
          source:           'biometric_sync',
          riskScore:        hrv_deviation_score,
          crisisProb,
          triggerFactors:   ['HRV below personal baseline by 40%+', 'Elevated Resting Heart Rate'],
          resolved:         false,
          timestamp:        new Date().toISOString()
        })
        console.log(`[BiometricSync] alert-created: clinicianAlert for uid=${uid} crisisProb=${crisisProb.toFixed(2)} at ${new Date().toISOString()}`)
      }
    } catch (err) {
      console.warn(`[BiometricSync] crisis-detect-warn: uid=${uid} — ${err.message}`)
    }
  }

  // 7. JITAI evaluation — HRV deviation above threshold
  if (hrvDeviationScore > 0.2) {
    try {
      // Check cycle vulnerability for dynamic receptivity (from LSTM model)
      let cycleVulnerability = 0
      try {
        const cycleRes = await axios.get(`${BACKEND_URL}/api/cycle/today/${uid}`, { timeout: 5000 })
        cycleVulnerability = cycleRes.data?.vulnerabilityScore || 0
      } catch { /* non-blocking */ }

      // If high cardiac stress during high vulnerability cycle phase → increase JITAI frequency
      const isHighVulnerabilityWindow = cardiacStressScore > 0.3 && cycleVulnerability > 0.6
      if (isHighVulnerabilityWindow) {
        console.log(`[BiometricSync] jitai-high-freq: uid=${uid} cardiac+cycle overlap detected at ${new Date().toISOString()}`)
      }

      await axios.post(`${BACKEND_URL}/api/jitai/evaluate/${uid}`, {
        triggerSource:       'biometric_sync',
        hrvDeviationScore,
        cardiacStressScore,
        cycleVulnerability,
        highFrequencyMode:   isHighVulnerabilityWindow
      }, { timeout: 10000 })
    } catch (err) {
      console.warn(`[BiometricSync] jitai-warn: uid=${uid} — ${err.message}`)
    }
  }

  console.log(`[BiometricSync] sync-complete: uid=${uid} at ${new Date().toISOString()}`)
  return true
}

// ── Sweep all connected users ─────────────────────────────────────────────────
const sweepAllUsers = async () => {
  const startTime = Date.now()
  console.log(`[BiometricSync] sweep-start: at ${new Date().toISOString()}`)

  const snap = await db.collection('users')
    .where('profileComplete', '==', true)
    .where('fitbitConnected', '==', true)
    .get()

  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.googleHealthTokens?.accessToken)

  let successCount = 0
  for (const user of users) {
    try {
      const ok = await syncUser(user.uid, user.googleHealthTokens)
      if (ok) successCount++
    } catch (err) {
      console.error(`[BiometricSync] sweep-error: uid=${user.uid} — ${err.message} at ${new Date().toISOString()}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[BiometricSync] sweep-complete: ${successCount}/${users.length} users synced in ${elapsed}s at ${new Date().toISOString()}`)
}

module.exports = { sweepAllUsers, syncUser }
