// routes/cycleRoutes.js
// All fixed day rules REMOVED. All decisions delegated to AI service LSTM.

const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { requireSelfOrAssignedClinician } = require('../middleware/authorize')
const { generalLimiter } = require('../middleware/rateLimiter')
const { validatePeriodLog } = require('../utils/validators')

const { ai } = require('../utils/aiClient')

// POST /api/cycle/log-period
// Log period start → triggers LSTM retraining for this user
router.post('/log-period', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const { periodStart } = req.body

    const validation = validatePeriodLog(req.body)
    if (!validation.valid) return res.status(400).json({ error: validation.error })

    // Fetch existing history to append
    const existing = await db.collection('cycleLogs').doc(uid).get()
    const prevHistory = existing.exists ? (existing.data().periodHistory || []) : []
    const updatedHistory = [...prevHistory, new Date(periodStart).toISOString()].slice(-24) // keep last 24 cycles

    // Trigger AI service LSTM retraining in background
    ai.post(`/api/cycle/train/${uid}`, { periodHistory: updatedHistory }).catch(err => {
      console.warn('LSTM retrain failed (non-blocking):', err.message)
    })

    // Get updated ML prediction from AI service
    const predictRes = await ai.get(`/api/cycle/predict/${uid}`, {
      params: { last_period: periodStart, history: updatedHistory }
    }).catch(() => ({ data: { vulnerabilityScore: 0, currentPhase: 'menstrual', predictedNextPeriod: null, modelType: 'population_fallback', currentDay: 1 } }))

    // Compute avg and variance
    const sortedHistory = [...updatedHistory].sort()
    const lengths = []
    for (let i = 1; i < sortedHistory.length; i++) {
      const days = Math.round((new Date(sortedHistory[i]) - new Date(sortedHistory[i - 1])) / 86400000)
      if (days >= 15 && days <= 90) lengths.push(days)
    }
    const avgCycleLength = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 28
    const variance = lengths.length > 1
      ? Math.sqrt(lengths.reduce((s, l) => s + (l - avgCycleLength) ** 2, 0) / lengths.length)
      : 0

    await db.collection('cycleLogs').doc(uid).set({
      uid, periodHistory: updatedHistory,
      avgCycleLength: Math.round(avgCycleLength),
      cycleVariance:  Math.round(variance * 10) / 10,
      isIrregular:    variance > 5,
      currentDay:     predictRes.data.currentDay || 1,
      vulnerabilityScore: predictRes.data.vulnerabilityScore || 0,
      modelType:      predictRes.data.modelType || 'population_fallback',
      predictedNextPeriod: predictRes.data.predictedNextPeriod || null,
      updatedAt:      new Date().toISOString()
    })

    // Update user periodHistory
    await db.collection('users').doc(uid).update({
      lastPeriodDate: new Date(periodStart).toISOString(),
      periodHistory:  updatedHistory,
      avgCycleLength: Math.round(avgCycleLength),
      cycleVariance:  Math.round(variance * 10) / 10,
      updatedAt:      new Date().toISOString()
    })

    res.json({
      message:             'Period logged. LSTM retraining triggered.',
      currentDay:          predictRes.data.currentDay || 1,
      vulnerabilityScore:  predictRes.data.vulnerabilityScore || 0,
      predictedNextPeriod: predictRes.data.predictedNextPeriod,
      modelType:           predictRes.data.modelType,
      totalCycles:         updatedHistory.length
    })
  } catch (error) {
    console.error('Cycle log error:', error)
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/cycle/log-period-end
router.put('/log-period-end', verifyToken, async (req, res) => {
  try {
    const { periodEnd } = req.body
    if (!periodEnd) return res.status(400).json({ error: 'periodEnd is required' })

    await db.collection('cycleLogs').doc(req.user.uid).update({
      lastPeriodEnd: new Date(periodEnd).toISOString(),
      updatedAt:     new Date().toISOString()
    })
    res.json({ message: 'Period end logged' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/cycle/today/:uid — current ML-predicted vulnerability (no fixed day rules)
router.get('/today/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const doc = await db.collection('cycleLogs').doc(req.params.uid).get()
    if (!doc.exists) {
      return res.json({ currentDay: 0, vulnerabilityScore: 0, currentPhase: 'unknown', modelType: 'no_data', message: 'No cycle data yet' })
    }

    const data = doc.data()
    // Refresh from AI service for live prediction
    const predictRes = await ai.get(`/api/cycle/predict/${req.params.uid}`).catch(() => null)
    if (predictRes) {
      return res.json({ ...data, ...predictRes.data })
    }
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/cycle/history/:uid
router.get('/history/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const doc = await db.collection('cycleLogs').doc(req.params.uid).get()
    if (!doc.exists) return res.json({ periodHistory: [], message: 'No cycle history yet' })
    const { periodHistory, avgCycleLength, cycleVariance, isIrregular } = doc.data()
    res.json({ periodHistory, avgCycleLength, cycleVariance, isIrregular })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/cycle/predict/:uid — next period + vulnerability window from LSTM
router.get('/predict/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const predictRes = await ai.get(`/api/cycle/predict/${req.params.uid}`, { timeout: 8000 })
    res.json(predictRes.data)
  } catch (error) {
    res.status(503).json({ error: 'AI service unavailable', message: error.message })
  }
})

module.exports = router