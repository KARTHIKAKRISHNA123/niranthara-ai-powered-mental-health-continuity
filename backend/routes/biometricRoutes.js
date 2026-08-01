// backend/routes/biometricRoutes.js
// Health Connect biometric sync endpoint — per Build Guide §28
//
// Flow:
//   Mobile (Health Connect / simulation) → POST /api/passive/biometric-sync
//   → Validate JWT → compute HRV deviation → update passiveLogs + userDoc
//   → re-score XGBoost risk → if spike → create clinicianAlert

const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken   = require('../middleware/verifyToken')
const { requireSelfOrAssignedClinician } = require('../middleware/authorize')
const { generalLimiter } = require('../middleware/rateLimiter')
const { sendClinicianCrisisAlert } = require('../services/notificationService')

const { ai } = require('../utils/aiClient')

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/passive/biometric-sync
// Receives Health Connect biometrics from mobile, stores them, re-runs XGBoost.
// ─────────────────────────────────────────────────────────────────────────────
// The scoring pipeline is extracted from the route handler so other ingest
// paths — currently the Google Health API cloud sync — run through exactly the
// same deviation maths, alert gate and XGBoost re-score rather than a parallel
// copy that could drift.
async function processBiometricSync(uid, payload) {
  {
    const {
      heartRate,
      restingHeartRate,
      hrv,
      steps,
      sleepHours,
      windowHours = 24,
      source       = 'health_connect',
      fetchedAt,
    } = payload

    // ── 1. Load user baseline ─────────────────────────────────────────────────
    const userDoc  = await db.collection('users').doc(uid).get()
    const userData = userDoc.exists ? userDoc.data() : {}
    const baseline = userData.baselineData || {}

    // ── 2. Compute deviation scores ───────────────────────────────────────────
    const avgHrBaseline  = baseline.avgHeartRate  || 75
    const avgHrvBaseline = baseline.avgHrv        || 45
    const avgStepBase    = baseline.avgSteps      || 6500
    const avgSleepBase   = baseline.avgSleep      || 7.2

    // Absent signals (null/undefined) are excluded from the score entirely —
    // treating "not synced yet" as 0 scored maximum deviation and could fire
    // false alerts when a vendor syncs only some record types (Fitbit never
    // writes HRV to Health Connect; steps/sleep can lag HR by hours).
    const hrDeviation    = heartRate != null
      ? Math.min(Math.abs(heartRate - avgHrBaseline) / avgHrBaseline, 1)
      : null
    const hrvDeviation   = hrv != null
      ? Math.min(Math.max((avgHrvBaseline - hrv) / avgHrvBaseline, 0), 1)
      : null
    const stepsDeviation = steps != null
      ? Math.min(Math.max((avgStepBase - steps) / avgStepBase, 0), 1)
      : null
    const sleepDeviation = sleepHours != null
      ? Math.min(Math.max((avgSleepBase - sleepHours) / avgSleepBase, 0), 1)
      : null

    // Weighted average over the signals we actually have, renormalized so a
    // partial sync is scored fairly (weights: HR .30, HRV .35, steps .20, sleep .15)
    const signals = [
      [hrDeviation,    0.30],
      [hrvDeviation,   0.35],
      [stepsDeviation, 0.20],
      [sleepDeviation, 0.15],
    ].filter(([d]) => d != null)
    const weightSum = signals.reduce((s, [, w]) => s + w, 0)
    const physiologicalStressScore = weightSum > 0
      ? signals.reduce((s, [d, w]) => s + d * w, 0) / weightSum
      : 0

    // ── 3. Write biometric log to Firestore ───────────────────────────────────
    const biometricLog = {
      uid,
      source,
      fetchedAt:              fetchedAt || new Date().toISOString(),
      createdAt:              new Date().toISOString(),
      windowHours,
      heartRate:              heartRate              ?? null,
      restingHeartRate:       restingHeartRate       ?? null,
      hrv:                    hrv                    ?? null,
      steps:                  steps                  ?? null,
      sleepHours:             sleepHours             ?? null,
      hrDeviation,
      hrvDeviation,
      stepsDeviation,
      sleepDeviation,
      signalCount:            signals.length,
      physiologicalStressScore: Math.round(physiologicalStressScore * 100) / 100,
    }

    const logRef = await db.collection('biometricLogs').add(biometricLog)

    // ── 4. Update user doc with latest biometric snapshot ─────────────────────
    await db.collection('users').doc(uid).set({
      lastBiometricSync:  new Date().toISOString(),
      lastHrvDeviation:   hrvDeviation != null ? Math.round(hrvDeviation * 100) / 100 : null,
      lastHr:             heartRate ?? null,
      lastHrv:            hrv       ?? null,
      physiologicalStress: Math.round(physiologicalStressScore * 100) / 100,
    }, { merge: true })

    // ── 5. Re-run XGBoost risk with biometric context ─────────────────────────
    let riskData = null
    let alertCreated = false
    try {
      const sevenAgo  = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7)
      const moodSnap  = await db.collection('moodLogs')
        .where('uid', '==', uid)
        .where('createdAt', '>=', sevenAgo.toISOString())
        .orderBy('createdAt', 'desc').limit(5).get()

      const moods = moodSnap.docs.map(d => d.data())
      const avg   = (arr, key) => arr.length
        ? arr.reduce((s, l) => s + (Number(l[key]) || 0), 0) / arr.length : 0

      const riskRes = await ai.post(`/api/predict/risk`, {
        uid,
        moodScore:               avg(moods, 'moodScore') || 3,
        sleepHours:              sleepHours || avg(moods, 'sleepHours') || 7,
        anxietyLevel:            avg(moods, 'anxietyLevel') || 5,
        sentimentScore:          avg(moods.map(m => m.nlpResults || {}), 'sentimentScore') || 0.5,
        emotionLabel:            moods[0]?.nlpResults?.emotionLabel || 'neutral',
        crisisProbability:       Math.max(...moods.map(m => m.nlpResults?.crisisProbability || 0), 0),
        cycleVulnerability:      userData.cycleVulnerability || 0,
        moodSentimentDivergence: avg(moods, 'moodSentimentDivergence') || 0,
        passiveLogs:             [{ stepsToday: steps, heartRate, hrv, physiologicalStressScore }],
        anomalyScore:            physiologicalStressScore,  // Feeds as the 15th feature
      }, { timeout: 12000 })

      riskData = riskRes.data

      // Update user risk level with biometric-aware score
      await db.collection('users').doc(uid).set({
        riskScore:  riskData.riskScore,
        riskLevel:  riskData.riskLevel,
        updatedAt:  new Date().toISOString(),
      }, { merge: true })

      // ── 6. Clinician alert if physiological stress spike ─────────────────────
      // Stress-score alerts require >= 2 corroborating signals — a single
      // deviant signal (elevated HR from stairs/caffeine) never alerts alone.
      // The XGBoost risk path (which fuses 7-day mood context) has no such
      // gate: it is already multi-signal by construction.
      const stressAlert = signals.length >= 2 && physiologicalStressScore > 0.55
      const spikeAlert  = stressAlert || riskData.riskScore > 0.60
      alertCreated = spikeAlert && !!userData.assignedClinician
      if (spikeAlert && userData.assignedClinician) {
        await db.collection('clinicianAlerts').add({
          patientUid:      uid,
          patientName:     userData.name || 'Patient',
          clinicianUid:    userData.assignedClinician,
          type:            'high_risk',
          riskScore:       riskData.riskScore,
          crisisProb:      0,
          triggerFactors:  [
            `Physiological stress score: ${(physiologicalStressScore * 100).toFixed(0)}% (${signals.length} signals)`,
            ...(hrvDeviation != null ? [`HRV deviation: ${(hrvDeviation * 100).toFixed(0)}% below baseline`] : []),
            ...(sleepHours != null ? [`Sleep: ${sleepHours}h (baseline ${avgSleepBase}h)`] : []),
          ],
          source:          'health_connect_biometrics',
          resolved:        false,
          resolvedAt:      null,
          timestamp:       new Date().toISOString(),
        })

        // FCM push (best-effort)
        try {
          const clinicianDoc = await db.collection('users').doc(userData.assignedClinician).get()
          const fcmToken     = clinicianDoc.exists ? clinicianDoc.data().fcmToken : null
          if (fcmToken) {
            await sendClinicianCrisisAlert(fcmToken, userData.name || 'A patient', riskData.riskScore)
          }
        } catch (fcmErr) {
          console.warn('[biometricSync] FCM push failed (non-fatal):', fcmErr.message)
        }
      }
    } catch (aiErr) {
      console.warn('[biometricSync] XGBoost re-score failed (non-fatal):', aiErr.message)
    }

    return {
      message:                  'Biometrics synced',
      logId:                    logRef.id,
      physiologicalStressScore: Math.round(physiologicalStressScore * 100) / 100,
      hrvDeviation:             hrvDeviation != null ? Math.round(hrvDeviation * 100) / 100 : null,
      signalCount:              signals.length,
      riskScore:                riskData?.riskScore || null,
      riskLevel:                riskData?.riskLevel || null,
      alertCreated,
    }
  }
}

router.post('/biometric-sync', generalLimiter, verifyToken, async (req, res) => {
  try {
    const result = await processBiometricSync(req.user.uid, req.body)
    res.status(201).json(result)
  } catch (error) {
    console.error('[biometricSync] Error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/passive/biometrics/:uid  — Latest biometric snapshot for dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/biometrics/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const snap = await db.collection('biometricLogs')
      .where('uid', '==', req.params.uid)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (snap.empty) return res.json({ message: 'No biometric data yet', uid: req.params.uid })
    res.json({ ...snap.docs[0].data(), id: snap.docs[0].id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Express mounts the default export; processBiometricSync is attached so the
// Google Health cloud sync can reuse the pipeline without an HTTP round-trip.
module.exports = router
module.exports.processBiometricSync = processBiometricSync
