// routes/jitaiRoutes.js
// All hardcoded arithmetic rules REMOVED. Delegates to AI service personalized XGBoost.

const express = require('express')
const router  = express.Router()
const axios   = require('axios')
const { db, fcm } = require('../config/firebase')
const verifyToken  = require('../middleware/verifyToken')
const { generalLimiter } = require('../middleware/rateLimiter')
const notificationService = require('../services/notificationService')

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// POST /api/jitai/evaluate/:uid — Personalized JITAI ML evaluation
router.post('/evaluate/:uid', verifyToken, async (req, res) => {
  try {
    const uid = req.params.uid
    const { riskScore, cycleVulnerability, stepsDeviationScore, crisisProbability, isInChat, hour_of_day, day_of_week } = req.body

    const now = new Date()
    const jitaiPayload = {
      uid,
      riskScore:           riskScore           || 0.3,
      cycleVulnerability:  cycleVulnerability  || 0,
      stepsDeviationScore: stepsDeviationScore || 0.3,
      crisisProbability:   crisisProbability   || 0,
      isInChat:            isInChat            || false,
      hour_of_day:         hour_of_day         ?? now.getHours(),
      day_of_week:         day_of_week         ?? now.getDay()
    }

    // Delegate fully to AI service personalized model
    const jitaiRes = await axios.post(`${AI_URL}/api/jitai/receptivity`, jitaiPayload, { timeout: 8000 })
    const result = jitaiRes.data

    if (result.shouldIntervene) {
      // Log the JITAI event
      const logRef = await db.collection('jitaiLogs').add({
        uid,
        interventionType:    result.interventionType,
        priority:            result.priority || 'medium',
        triggerReasons:      result.triggerReasons || [],
        riskScoreAtTrigger:  riskScore || 0.3,
        receptivityScore:    result.receptivityScore,
        notificationSent:    false,
        openedByUser:        false,
        responseType:        null,
        responseTimeMs:      null,
        feedbackToModel:     false,
        timestamp:           now.toISOString()
      })
      result.logId = logRef.id
    }

    res.json(result)
  } catch (error) {
    console.error('JITAI evaluate error:', error.message)
    // Graceful fallback — no intervention, don't crash
    res.json({ shouldIntervene: false, interventionType: 'none', receptivityScore: 0, reasoning: 'AI service unavailable' })
  }
})

// POST /api/jitai/send-notification — FCM push
router.post('/send-notification', verifyToken, async (req, res) => {
  try {
    const { uid, interventionType, logId, title, body } = req.body

    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' })

    const fcmToken = userDoc.data().fcmToken
    if (!fcmToken) return res.status(400).json({ error: 'No FCM token for user' })

    await notificationService.sendJITAINotification(fcmToken, interventionType, title, body)

    // Mark notification as sent
    if (logId) {
      await db.collection('jitaiLogs').doc(logId).update({ notificationSent: true })
    }

    res.json({ message: 'Notification sent' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/jitai/log-response — User response (training signal for personalized model)
router.post('/log-response', verifyToken, async (req, res) => {
  try {
    const { logId, responseType, responseTimeMs } = req.body
    if (!logId) return res.status(400).json({ error: 'logId is required' })

    const validResponses = ['feel_better', 'need_more_help', 'ignored']
    if (!validResponses.includes(responseType))
      return res.status(400).json({ error: `responseType must be one of: ${validResponses.join(', ')}` })

    await db.collection('jitaiLogs').doc(logId).update({
      openedByUser:    true,
      responseType,
      responseTimeMs:  responseTimeMs || null,
      feedbackToModel: true
    })

    // Retrain user's personalized JITAI model with new response
    const logDoc = await db.collection('jitaiLogs').doc(logId).get()
    if (logDoc.exists) {
      const uid = logDoc.data().uid
      const historySnap = await db.collection('jitaiLogs')
        .where('uid', '==', uid)
        .where('feedbackToModel', '==', true)
        .orderBy('timestamp', 'desc').limit(50).get()

      const history = historySnap.docs.map(d => d.data())
      axios.post(`${AI_URL}/api/jitai/train`, { uid, history }).catch(e => {
        console.warn('JITAI retrain non-blocking error:', e.message)
      })
    }

    res.json({ message: 'Response logged. Model will be updated.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/jitai/history/:uid
router.get('/history/:uid', generalLimiter, verifyToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query
    const snap = await db.collection('jitaiLogs')
      .where('uid', '==', req.params.uid)
      .orderBy('timestamp', 'desc').limit(Number(limit)).get()

    const history  = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    const responded = history.filter(h => h.responseType === 'feel_better').length
    const responseRate = history.length ? (responded / history.length) : 0

    res.json({ history, stats: { total: history.length, responseRate: Math.round(responseRate * 100) } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/jitai/active/:uid — Active pending intervention
router.get('/active/:uid', generalLimiter, verifyToken, async (req, res) => {
  try {
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - 4) // 4-hour window
    const snap = await db.collection('jitaiLogs')
      .where('uid', '==', req.params.uid)
      .where('notificationSent', '==', true)
      .where('responseType', '==', null)
      .where('timestamp', '>=', cutoff.toISOString())
      .orderBy('timestamp', 'desc').limit(1).get()

    if (snap.empty) return res.json({ active: false })
    res.json({ active: true, intervention: { id: snap.docs[0].id, ...snap.docs[0].data() } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router