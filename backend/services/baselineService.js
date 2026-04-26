// services/baselineService.js
// Computes and stores 30-day personal baseline per Build Guide §6

const { db } = require('../config/firebase')

const CALIBRATION_DAYS = 14

/**
 * Checks if user has enough data (14+ days) to compute baseline.
 * Called after every passive log. Non-blocking.
 */
const checkAndUpdateBaseline = async (uid) => {
  try {
    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) return
    const user = userDoc.data()
    if (user.baselineCalibrated) return  // Already calibrated — update monthly only

    const cutoff = new Date(user.createdAt)
    cutoff.setDate(cutoff.getDate() + CALIBRATION_DAYS)
    if (new Date() < cutoff) return  // Not enough time elapsed

    await computeAndSaveBaseline(uid)
  } catch (err) {
    console.warn('Baseline check error (non-blocking):', err.message)
  }
}

/**
 * Compute 30-day rolling baseline from passive logs.
 * Uses personal average and std deviation — not population thresholds.
 */
const computeAndSaveBaseline = async (uid) => {
  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const snap = await db.collection('passiveLogs')
    .where('uid', '==', uid)
    .where('createdAt', '>=', thirtyAgo.toISOString())
    .orderBy('createdAt', 'desc')
    .get()

  const logs = snap.docs.map(d => d.data())
  if (logs.length < 7) return null  // Insufficient data

  const steps   = logs.map(l => l.stepsToday     || 0).filter(v => v > 0)
  const sleep   = logs.map(l => l.sleepProxyHours || 0).filter(v => v > 0)
  const entropy = logs.map(l => l.gpsEntropy      || 0)

  const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const std  = arr => {
    if (arr.length < 2) return 1
    const m = mean(arr)
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) || 1
  }

  const baselineData = {
    avgSteps:      Math.round(mean(steps)),
    avgSleep:      Math.round(mean(sleep) * 10) / 10,
    avgGpsEntropy: Math.round(mean(entropy) * 10) / 10,
    stdSteps:      Math.round(std(steps)),
    stdSleep:      Math.round(std(sleep) * 10) / 10,
    computedAt:    new Date().toISOString(),
    dataPoints:    logs.length
  }

  await db.collection('users').doc(uid).update({
    baselineData,
    baselineCalibrated: true,
    updatedAt: new Date().toISOString()
  })

  return baselineData
}

/**
 * Compute deviation score from personal baseline (z-score normalized to 0–1).
 * Never uses population thresholds — always personal baseline.
 */
const deviationScore = (todayValue, baselineAvg, baselineStd) => {
  if (!baselineAvg || !baselineStd) return 0.3  // Default during calibration
  const z = (baselineAvg - todayValue) / Math.max(baselineStd, 0.01)
  return Math.min(Math.max(z / 3, 0), 1.0)
}

module.exports = { checkAndUpdateBaseline, computeAndSaveBaseline, deviationScore }
