// services/jitaiScheduler.js
// node-cron: hourly JITAI evaluation + midnight full depression detection

const cron = require('node-cron')
const { db } = require('../config/firebase')
const notificationService = require('./notificationService')
const baselineService     = require('./baselineService')

const { ai } = require('../utils/aiClient')

const daysSince = (isoString) => {
  if (!isoString) return 0
  return (new Date() - new Date(isoString)) / (1000 * 60 * 60 * 24)
}

// ── Every hour: JITAI evaluation for all active users ─────────────────────
cron.schedule('0 * * * *', async () => {
  console.log('[JITAI Scheduler] Hourly run:', new Date().toISOString())
  try {
    const snap = await db.collection('users')
      .where('role', '==', 'user')
      .where('profileComplete', '==', true)
      .where('permissions.notifications', '==', true)
      .get()

    for (const userDoc of snap.docs) {
      const user = userDoc.data()
      const uid  = user.uid
      if (!uid) continue

      try {
        // Get latest passive and mood data
        const [passiveSnap, moodSnap, cycleDoc, jitaiSnap] = await Promise.all([
          db.collection('passiveLogs').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(1).get(),
          db.collection('moodLogs').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(1).get(),
          db.collection('cycleLogs').doc(uid).get(),
          db.collection('jitaiLogs').where('uid', '==', uid).orderBy('timestamp', 'desc').limit(10).get()
        ])

        const passive = passiveSnap.empty ? {} : passiveSnap.docs[0].data()
        const mood    = moodSnap.empty    ? {} : moodSnap.docs[0].data()
        const cycle   = cycleDoc.exists ? cycleDoc.data() : {}
        const jitai   = jitaiSnap.docs.map(d => d.data())
        const lastMoodAt = mood.createdAt || mood.date || mood.timestamp || user.createdAt

        const dropoutRes = await ai.post(`/api/dropout/predict`, {
          uid,
          daysSinceLastCheckin: daysSince(lastMoodAt),
          notificationOpenRateTrend: user.notificationOpenRateTrend ?? 0.5,
          sessionLengthTrend: user.sessionLengthTrend ?? 0.5,
          jitaiResponseRate: user.jitaiResponseRate ?? (jitai.length ? jitai.filter(j => j.openedByUser).length / Math.max(jitai.filter(j => j.notificationSent).length, 1) : 0.5),
          appOpenFrequency7dTrend: user.appOpenFrequency7dTrend ?? Math.min(passive && passive.createdAt ? 1 : 0.5, 1),
          passiveLogs: passiveSnap.empty ? [] : [passive],
          moodLogs: moodSnap.empty ? [] : [mood],
          jitaiLogs: jitai
        }, { timeout: 10000 }).catch(() => ({ data: { dropoutProbability: 0.3, willDropOutIn7d: false, topFactors: [] } }))

        const dropoutProbability = dropoutRes.data.dropoutProbability || 0

        const now = new Date()
        const jitaiPayload = {
          uid,
          riskScore:           Math.max(user.riskScore || 0.3, dropoutProbability),
          cycleVulnerability:  cycle.vulnerabilityScore  || 0,
          stepsDeviationScore: passive.stepsDeviationScore || 0.3,
          crisisProbability:   mood.nlpResults?.crisisProbability || 0,
          isInChat:            false,
          hour_of_day:         now.getHours(),
          day_of_week:         now.getDay()
        }

        const jitaiRes = await ai.post(`/api/jitai/receptivity`, jitaiPayload, { timeout: 8000 })
        const result   = jitaiRes.data

        if (result.shouldIntervene && user.fcmToken) {
          const logRef = await db.collection('jitaiLogs').add({
            uid, interventionType: result.interventionType, priority: result.priority || 'medium',
            triggerReasons: result.triggerReasons || [], riskScoreAtTrigger: user.riskScore || 0,
            receptivityScore: result.receptivityScore, notificationSent: false, openedByUser: false,
            responseType: null, feedbackToModel: false, timestamp: now.toISOString()
          })

          await notificationService.sendJITAINotification(user.fcmToken, result.interventionType, null, null)
          await logRef.update({ notificationSent: true })
        }
      } catch (userErr) {
        console.warn(`[JITAI] Error for uid ${uid}:`, userErr.message)
      }
    }
  } catch (err) {
    console.error('[JITAI Scheduler] Hourly error:', err.message)
  }
})

// ── Midnight: Full 8-trigger XGBoost + baseline update + clinician alerts ─
cron.schedule('0 0 * * *', async () => {
  console.log('[JITAI Scheduler] Midnight full run:', new Date().toISOString())
  try {
    const snap = await db.collection('users').where('role', '==', 'user').get()

    for (const userDoc of snap.docs) {
      const user = userDoc.data()
      const uid  = user.uid
      if (!uid) continue

      try {
        // Update baseline rolling window
        if (user.baselineCalibrated) {
          await baselineService.computeAndSaveBaseline(uid)
        }

        // Get full feature set for XGBoost
        const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7)
        const [moodSnap, passiveSnap, cycleDoc] = await Promise.all([
          db.collection('moodLogs').where('uid', '==', uid).where('createdAt', '>=', sevenAgo.toISOString()).orderBy('createdAt', 'desc').get(),
          db.collection('passiveLogs').where('uid', '==', uid).where('createdAt', '>=', sevenAgo.toISOString()).orderBy('createdAt', 'desc').get(),
          db.collection('cycleLogs').doc(uid).get()
        ])

        const moods   = moodSnap.docs.map(d => d.data())
        const passive = passiveSnap.docs.map(d => d.data())
        const cycle   = cycleDoc.exists ? cycleDoc.data() : {}

        if (moods.length === 0) continue  // No data yet

        const avg = (arr, key) => arr.length ? arr.reduce((s, l) => s + (Number(l[key]) || 0), 0) / arr.length : 0

        const riskRes = await ai.post(`/api/predict/risk`, {
          uid,
          moodScore:              avg(moods, 'moodScore'),
          sleepHours:             avg(moods, 'sleepHours'),
          anxietyLevel:           avg(moods, 'anxietyLevel'),
          sentimentScore:         avg(moods.map(m => m.nlpResults || {}), 'sentimentScore') || 0.5,
          emotionLabel:           moods[0]?.nlpResults?.emotionLabel || 'neutral',
          crisisProbability:      Math.max(...moods.map(m => m.nlpResults?.crisisProbability || 0), 0),
          cycleVulnerability:     cycle.vulnerabilityScore || 0,
          moodSentimentDivergence: avg(moods, 'moodSentimentDivergence'),
          passiveLogs:            passive
        }, { timeout: 12000 })

        const dropoutRes = await ai.post(`/api/dropout/predict`, {
          uid,
          daysSinceLastCheckin: daysSince(moods[0]?.createdAt || moods[0]?.date || moods[0]?.timestamp || user.createdAt),
          notificationOpenRateTrend: user.notificationOpenRateTrend ?? 0.5,
          sessionLengthTrend: user.sessionLengthTrend ?? 0.5,
          jitaiResponseRate: user.jitaiResponseRate ?? 0.5,
          appOpenFrequency7dTrend: user.appOpenFrequency7dTrend ?? 0.5,
          passiveLogs: passive,
          moodLogs: moods,
          jitaiLogs: []
        }, { timeout: 10000 }).catch(() => ({ data: { dropoutProbability: 0.3, willDropOutIn7d: false, topFactors: [] } }))

        const { riskScore, riskLevel, topFactors } = riskRes.data
        const dropoutProbability = dropoutRes.data.dropoutProbability || 0
        const effectiveRiskScore = Math.max(riskScore || 0, dropoutProbability)

        await db.collection('users').doc(uid).update({ riskScore: effectiveRiskScore, riskLevel, updatedAt: new Date().toISOString() })
        await db.collection('users').doc(uid).update({
          dropoutProbability,
          dropoutRiskLevel: dropoutProbability > 0.7 ? 'high' : 'low',
          dropoutTopFactors: dropoutRes.data.topFactors || [],
          updatedAt: new Date().toISOString()
        })

        // Clinician alert if risk > 0.7
        if (riskScore > 0.7 && user.assignedClinician) {
          const existing = await db.collection('clinicianAlerts')
            .where('patientUid', '==', uid)
            .where('resolved', '==', false)
            .where('type', '==', 'high_risk')
            .limit(1).get()

          if (existing.empty) {
            await db.collection('clinicianAlerts').add({
              patientUid: uid, clinicianUid: user.assignedClinician,
              type: 'high_risk', riskScore, crisisProb: 0,
              triggerFactors: topFactors || [], resolved: false, resolvedAt: null,
              timestamp: new Date().toISOString()
            })
          }
        }

        if (dropoutProbability > 0.7 && user.assignedClinician) {
          const existingDropout = await db.collection('clinicianAlerts')
            .where('patientUid', '==', uid)
            .where('resolved', '==', false)
            .where('type', '==', 'dropout_risk')
            .limit(1).get()

          if (existingDropout.empty) {
            await db.collection('clinicianAlerts').add({
              patientUid: uid, clinicianUid: user.assignedClinician,
              type: 'dropout_risk', riskScore: user.riskScore || 0,
              dropoutProbability,
              crisisProb: 0,
              triggerFactors: dropoutRes.data.topFactors || ['Disengagement signals detected'],
              resolved: false, resolvedAt: null,
              timestamp: new Date().toISOString(),
              message: 'Patient showing disengagement signals; simplified check-in mode recommended.'
            })
          }
        }
      } catch (userErr) {
        console.warn(`[Midnight] Error for uid ${uid}:`, userErr.message)
      }
    }

    console.log('[JITAI Scheduler] Midnight run complete')
  } catch (err) {
    console.error('[JITAI Scheduler] Midnight error:', err.message)
  }
})

console.log('[JITAI Scheduler] Hourly + midnight cron jobs registered')
