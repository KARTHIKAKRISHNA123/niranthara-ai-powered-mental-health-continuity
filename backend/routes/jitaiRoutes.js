// routes/jitaiRoutes.js
// All hardcoded arithmetic rules REMOVED. Delegates to AI service personalized XGBoost.

const express = require('express')
const router  = express.Router()
const { db, fcm } = require('../config/firebase')
const verifyToken  = require('../middleware/verifyToken')
const { generalLimiter } = require('../middleware/rateLimiter')
const notificationService = require('../services/notificationService')

const { ai } = require('../utils/aiClient')
const { normalizeIntervention } = require('../utils/interventions')
const { encrypt } = require('../utils/encryption')

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
    const jitaiRes = await ai.post(`/api/jitai/receptivity`, jitaiPayload, { timeout: 8000 })
    const result = jitaiRes.data

    if (result.shouldIntervene) {
      // Log the JITAI event
      const logRef = await db.collection('jitaiLogs').add({
        uid,
        interventionType:    normalizeIntervention(result.interventionType),
        source:              'jitai',
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
//
// This route used to hard-require `logId`, but nothing in the mobile app could
// supply one: no screen consumed /jitai/active, so a patient who completed a
// breathing exercise produced a 400 that the screen swallowed. Every completed
// intervention was silently lost, and the outcome loop only ever saw seeded data.
//
// It now resolves the intervention itself:
//   1. explicit logId, if the caller has one (notification deep-link path)
//   2. otherwise the most recent unanswered intervention of this type in 4h
//   3. otherwise create a self-initiated record — a patient who opens breathing
//      unprompted is real engagement and belongs in the effectiveness data
router.post('/log-response', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const { responseType, responseTimeMs } = req.body
    let   { logId } = req.body
    const interventionType = normalizeIntervention(req.body.interventionType)

    const validResponses = ['feel_better', 'need_more_help', 'ignored']
    if (!validResponses.includes(responseType))
      return res.status(400).json({ error: `responseType must be one of: ${validResponses.join(', ')}` })

    if (!logId && interventionType === 'unknown')
      return res.status(400).json({ error: 'logId or a known interventionType is required' })

    let source = 'jitai'

    if (!logId) {
      // Match this completion to a pending delivery. In-memory filter and sort:
      // the composite index for (uid, interventionType, responseType, timestamp)
      // does not exist, and the rest of the project deliberately avoids adding
      // indexes at demo scale.
      const cutoff = new Date(Date.now() - 4 * 3600 * 1000).toISOString()
      const snap = await db.collection('jitaiLogs').where('uid', '==', uid).get()
      const pending = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(j => !j.responseType &&
                     j.timestamp >= cutoff &&
                     normalizeIntervention(j.interventionType) === interventionType)
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))

      if (pending.length) {
        logId = pending[0].id
      } else {
        const now = new Date()
        const ref = await db.collection('jitaiLogs').add({
          uid,
          interventionType,
          source:             'self_initiated',
          priority:           'low',
          triggerReasons:     ['Patient-initiated — opened from the app, not from a notification'],
          riskScoreAtTrigger: req.body.riskScoreAtTrigger ?? 0,
          receptivityScore:   null,
          notificationSent:   false,
          openedByUser:       true,
          responseType:       null,
          feedbackToModel:    false,
          hour_of_day:        now.getHours(),
          day_of_week:        now.getDay(),
          timestamp:          now.toISOString(),
          createdAt:          now.toISOString(),
        })
        logId = ref.id
        source = 'self_initiated'
      }
    }

    // Therapeutic content the patient produced during the exercise (CBT thought
    // records). It is clinical free text, so it gets the same AES-256-GCM
    // treatment as journals and chat — never stored in the clear.
    const content = req.body.content && typeof req.body.content === 'object' ? req.body.content : null
    const contentEncrypted = content
      ? Object.fromEntries(Object.entries(content)
          .filter(([, v]) => typeof v === 'string' && v.trim())
          .map(([k, v]) => [k, encrypt(v)]))
      : null

    await db.collection('jitaiLogs').doc(logId).update({
      openedByUser:    true,
      responseType,
      responseTimeMs:  responseTimeMs || null,
      completedAt:     new Date().toISOString(),
      feedbackToModel: true,
      ...(contentEncrypted ? { contentEncrypted } : {})
    })

    // Retrain user's personalized JITAI model with new response
    const logDoc = await db.collection('jitaiLogs').doc(logId).get()
    if (logDoc.exists) {
      const uid = logDoc.data().uid
      // Fetch by uid only, then filter and sort in memory. The two-equality +
      // orderBy form needs a composite index that does not exist in this
      // project, so it threw FAILED_PRECONDITION *after* the response was
      // already written — the thought record saved fine and the patient still
      // got "Could not save the thought record". Same in-memory rule the rest
      // of the codebase follows at demo scale.
      const historySnap = await db.collection('jitaiLogs').where('uid', '==', uid).get()

      const history = historySnap.docs
        .map(d => d.data())
        .filter(h => h.feedbackToModel === true)
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        .slice(0, 50)
      ai.post(`/api/jitai/train`, { uid, history }).catch(e => {
        console.warn('JITAI retrain non-blocking error:', e.message)
      })
    }

    // A logged response changes engagement, which changes effectiveness. Recompute
    // now so the clinician dashboard is current without waiting for a check-in.
    require('../services/outcomeService').computeOutcomes(uid)
      .catch(e => console.warn('[jitai] outcome recompute failed (non-fatal):', e.message))

    res.json({ message: 'Response logged. Model will be updated.', logId, source, interventionType })
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