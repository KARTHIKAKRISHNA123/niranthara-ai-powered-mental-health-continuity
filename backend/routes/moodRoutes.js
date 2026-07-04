// routes/moodRoutes.js — Full 8-step NLP pipeline per Build Guide §14
// Demo-optimised: alert fires at crisisProb > 0.5 OR riskScore > 0.6

const express = require('express')
const router  = express.Router()
const axios   = require('axios')
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { requireSelfOrAssignedClinician } = require('../middleware/authorize')
const { nlpLimiter, generalLimiter } = require('../middleware/rateLimiter')
const { encrypt } = require('../utils/encryption')
const { validateMoodLog } = require('../utils/validators')
const { sendClinicianCrisisAlert } = require('../services/notificationService')

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

const getRecentPassiveLogs = async (uid, days = 7) => {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const snap = await db.collection('passiveLogs')
      .where('uid', '==', uid)
      .where('createdAt', '>=', cutoff.toISOString())
      .orderBy('createdAt', 'desc').limit(days).get()
    return snap.docs.map(d => d.data())
  } catch { return [] }
}

// POST /api/mood/log
router.post('/log', nlpLimiter, verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const { moodScore, energyLevel, anxietyLevel, sleepHours, journalText, symptoms, offlineSyncId } = req.body

    const validation = validateMoodLog(req.body)
    if (!validation.valid) return res.status(400).json({ error: validation.error })

    // Step 1 — Encrypt journal immediately
    const encryptedJournal = journalText ? encrypt(journalText) : ''

    // Step 2 — Parallel NLP pipeline
    let nlpResults = { sentimentScore: 0.5, sentimentLabel: 'neutral', emotionLabel: 'neutral', emotionConfidence: 0.5, crisisProbability: 0, detectedLanguage: 'en' }

    if (journalText && journalText.trim().length > 5) {
      const [sentRes, emoRes, crisisRes] = await Promise.allSettled([
        axios.post(`${AI_URL}/api/sentiment/analyze`, { text: journalText }, { timeout: 10000 }),
        axios.post(`${AI_URL}/api/emotion/detect`,    { text: journalText }, { timeout: 10000 }),
        axios.post(`${AI_URL}/api/crisis/detect`,     { text: journalText, uid }, { timeout: 10000 })
      ])
      if (sentRes.status   === 'fulfilled') { nlpResults.sentimentScore = sentRes.value.data.score; nlpResults.sentimentLabel = sentRes.value.data.label; nlpResults.detectedLanguage = sentRes.value.data.language }
      if (emoRes.status    === 'fulfilled') { nlpResults.emotionLabel = emoRes.value.data.emotion; nlpResults.emotionConfidence = emoRes.value.data.confidence }
      if (crisisRes.status === 'fulfilled') { nlpResults.crisisProbability = crisisRes.value.data.crisisProbability }
    }

    // Step 3 — Mood-sentiment divergence (suppression signal)
    const moodPos = 1 - ((Number(moodScore || 3) - 1) / 4)
    const sentPos = 1 - nlpResults.sentimentScore
    const divergence = Math.abs(moodPos - sentPos)

    // Step 4 — Personalized cycle vulnerability (LSTM)
    const cycleRes = await axios.get(`${AI_URL}/api/cycle/predict/${uid}`, { timeout: 8000 })
      .catch(() => ({ data: { vulnerabilityScore: 0, currentPhase: 'unknown', currentDay: 0 } }))

    // Step 5 — XGBoost 14-feature risk prediction
    const passiveLogs = await getRecentPassiveLogs(uid)
    const riskRes = await axios.post(`${AI_URL}/api/predict/risk`, {
      uid, moodScore: Number(moodScore || 3), energyLevel: Number(energyLevel || 5),
      anxietyLevel: Number(anxietyLevel || 5), sleepHours: Number(sleepHours || 7),
      sentimentScore: nlpResults.sentimentScore, emotionLabel: nlpResults.emotionLabel,
      crisisProbability: nlpResults.crisisProbability, cycleVulnerability: cycleRes.data.vulnerabilityScore || 0,
      moodSentimentDivergence: divergence, passiveLogs
    }, { timeout: 12000 })
      .catch(() => ({ data: { riskScore: 0.3, riskLevel: 'low', topFactors: [] } }))

    // Step 6 — Alert clinician if crisis prob > 0.5 OR XGBoost risk > 0.6 (demo-reliable threshold)
    const isCrisis   = nlpResults.crisisProbability > 0.50
    const isHighRisk = riskRes.data.riskScore > 0.60
    if (isCrisis || isHighRisk) {
      const userDoc     = await db.collection('users').doc(uid).get()
      const userData    = userDoc.exists ? userDoc.data() : {}
      const alertType   = isCrisis ? 'crisis' : 'high_risk'

      // 6a — Write Firestore alert (triggers real-time dashboard onSnapshot)
      await db.collection('clinicianAlerts').add({
        patientUid:     uid,
        patientName:    userData.name || 'Patient',
        clinicianUid:   userData.assignedClinician || '',
        type:           alertType,
        riskScore:      riskRes.data.riskScore,
        crisisProb:     nlpResults.crisisProbability,
        triggerFactors: riskRes.data.topFactors || [],
        emotionLabel:   nlpResults.emotionLabel,
        divergenceScore: divergence,
        resolved:       false,
        resolvedAt:     null,
        timestamp:      new Date().toISOString()
      })

      // 6b — FCM push to clinician (best-effort, non-fatal if token missing)
      try {
        if (userData.assignedClinician) {
          const clinicianDoc = await db.collection('users').doc(userData.assignedClinician).get()
          const fcmToken     = clinicianDoc.exists ? clinicianDoc.data().fcmToken : null
          if (fcmToken) {
            await sendClinicianCrisisAlert(fcmToken, userData.name || 'A patient', riskRes.data.riskScore)
          }
        }
      } catch (fcmErr) {
        console.warn('[moodRoutes] FCM push failed (non-fatal):', fcmErr.message)
      }
    }

    // Step 7 — Save complete log
    const logRef = await db.collection('moodLogs').add({
      uid, date: new Date().toISOString(),
      moodScore: Number(moodScore || 3), energyLevel: Number(energyLevel || 5),
      anxietyLevel: Number(anxietyLevel || 5), sleepHours: Number(sleepHours || 7),
      journalText: encryptedJournal, journalLanguage: nlpResults.detectedLanguage,
      symptoms: symptoms || [], nlpResults, moodSentimentDivergence: divergence,
      cycleDay: cycleRes.data.currentDay || 0, cycleVulnerability: cycleRes.data.vulnerabilityScore || 0,
      riskScore: riskRes.data.riskScore, riskLevel: riskRes.data.riskLevel, topFactors: riskRes.data.topFactors || [],
      offlineSyncId: offlineSyncId || null, syncedToFirestore: true, createdAt: new Date().toISOString()
    })

    // Step 8 — Update user risk level (+ topFactors so the dashboard SHAP
    // panel reads live data — it renders patient.topFactors)
    await db.collection('users').doc(uid).update({ riskLevel: riskRes.data.riskLevel, riskScore: riskRes.data.riskScore, topFactors: riskRes.data.topFactors || [], updatedAt: new Date().toISOString() })

    res.status(201).json({
      message: 'Mood logged successfully', id: logRef.id,
      riskLevel: riskRes.data.riskLevel, riskScore: riskRes.data.riskScore,
      crisisProbability: nlpResults.crisisProbability, emotionDetected: nlpResults.emotionLabel,
      topFactors: riskRes.data.topFactors, requiresImmediateAction: nlpResults.crisisProbability > 0.75
    })
  } catch (error) {
    console.error('Mood log error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/mood/weekly/:uid
router.get('/weekly/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const ago = new Date(); ago.setDate(ago.getDate() - 7)
    const snap = await db.collection('moodLogs').where('uid', '==', req.params.uid).where('createdAt', '>=', ago.toISOString()).orderBy('createdAt', 'desc').get()
    const logs = snap.docs.map(doc => { const { journalText, ...d } = doc.data(); return { id: doc.id, ...d, hasJournal: !!journalText } })
    res.json({ logs, count: logs.length })
  } catch (error) { res.status(500).json({ error: error.message }) }
})

// GET /api/mood/monthly/:uid
router.get('/monthly/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const ago = new Date(); ago.setDate(ago.getDate() - 30)
    const snap = await db.collection('moodLogs').where('uid', '==', req.params.uid).where('createdAt', '>=', ago.toISOString()).orderBy('createdAt', 'desc').get()
    const logs = snap.docs.map(doc => { const { journalText, ...d } = doc.data(); return { id: doc.id, ...d } })
    const avg = (arr, key) => arr.length ? arr.reduce((s, l) => s + (l[key] || 0), 0) / arr.length : 0
    res.json({ logs, aggregates: { avgMood: avg(logs, 'moodScore'), avgRisk: avg(logs, 'riskScore'), avgSleep: avg(logs, 'sleepHours'), crisisEvents: logs.filter(l => l.nlpResults?.crisisProbability > 0.85).length, totalLogs: logs.length } })
  } catch (error) { res.status(500).json({ error: error.message }) }
})

// GET /api/mood/history/:uid — paginated
router.get('/history/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const { limit = 20, startAfter } = req.query
    let q = db.collection('moodLogs').where('uid', '==', req.params.uid).orderBy('createdAt', 'desc').limit(Number(limit))
    if (startAfter) { const cursor = await db.collection('moodLogs').doc(startAfter).get(); if (cursor.exists) q = q.startAfter(cursor) }
    const snap = await q.get()
    const logs = snap.docs.map(doc => { const { journalText, ...d } = doc.data(); return { id: doc.id, ...d, hasJournal: !!journalText } })
    res.json({ logs, hasMore: logs.length === Number(limit) })
  } catch (error) { res.status(500).json({ error: error.message }) }
})

module.exports = router