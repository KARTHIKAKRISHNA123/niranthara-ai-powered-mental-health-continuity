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
    const { periodStart, flow, symptoms = [] } = req.body

    const validation = validatePeriodLog(req.body)
    if (!validation.valid) return res.status(400).json({ error: validation.error })
    if (new Date(periodStart) > new Date(Date.now() + 86400000)) {
      return res.status(400).json({ error: 'periodStart cannot be in the future' })
    }

    // Fetch existing history to append
    const existing = await db.collection('cycleLogs').doc(uid).get()
    const prevHistory = existing.exists ? (existing.data().periodHistory || []) : []

    // De-duplicate by calendar day. Tapping "log period" twice used to append
    // two starts one second apart, which the LSTM read as a 0-day cycle.
    const startIso = new Date(periodStart).toISOString()
    const startDay = dayKey(startIso)
    const updatedHistory = [...prevHistory.filter(d => dayKey(d) !== startDay), startIso]
      .sort()
      .slice(-24) // keep last 24 cycles

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

    // Day 1 of the period is itself a day log, so flow/symptoms captured on the
    // start screen land in the same place as every later day.
    if (flow || (Array.isArray(symptoms) && symptoms.length)) {
      await db.collection('cycleDayLogs').doc(`${uid}_${startDay}`).set({
        uid, date: startIso, dayKey: startDay, periodDay: 1,
        flow: flow || null, symptoms: Array.isArray(symptoms) ? symptoms : [],
        updatedAt: new Date().toISOString()
      }, { merge: true })
    }

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

// ── Per-day period logging ───────────────────────────────────────────────────
// "Log period start" alone could only ever record day 1. These endpoints record
// each day of a period with its flow and symptoms, which is what the LSTM needs
// to learn period *length* (not just interval) and what the clinician view needs
// to correlate somatic symptoms with mood.
//
// Doc id is `${uid}_${YYYY-MM-DD}` so re-logging a day overwrites it instead of
// creating duplicates — users routinely tap twice.

const VALID_FLOW = ['spotting', 'light', 'medium', 'heavy']
const VALID_SYMPTOMS = [
  'cramps', 'headache', 'fatigue', 'bloating', 'mood_swings',
  'breast_tenderness', 'nausea', 'back_pain', 'insomnia', 'acne',
  'anxiety', 'low_mood', 'food_cravings', 'dizziness'
]

const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10)

// POST /api/cycle/log-day — record one day of a period
router.post('/log-day', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const { date, periodDay, flow, symptoms = [], notes } = req.body

    if (!date || isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: 'date is required and must be a valid ISO date' })
    }
    if (new Date(date) > new Date(Date.now() + 86400000)) {
      return res.status(400).json({ error: 'date cannot be in the future' })
    }
    if (flow && !VALID_FLOW.includes(flow)) {
      return res.status(400).json({ error: `flow must be one of: ${VALID_FLOW.join(', ')}` })
    }
    if (!Array.isArray(symptoms) || symptoms.some(s => !VALID_SYMPTOMS.includes(s))) {
      return res.status(400).json({ error: `symptoms must be a subset of: ${VALID_SYMPTOMS.join(', ')}` })
    }
    if (periodDay !== undefined && (!Number.isInteger(periodDay) || periodDay < 1 || periodDay > 15)) {
      return res.status(400).json({ error: 'periodDay must be an integer between 1 and 15' })
    }

    const key = `${uid}_${dayKey(date)}`
    await db.collection('cycleDayLogs').doc(key).set({
      uid,
      date:      new Date(date).toISOString(),
      dayKey:    dayKey(date),
      periodDay: periodDay ?? null,
      flow:      flow || null,
      symptoms,
      notes:     (notes || '').slice(0, 300),
      updatedAt: new Date().toISOString()
    }, { merge: true })

    res.status(201).json({ message: 'Day logged', id: key, periodDay: periodDay ?? null, flow: flow || null, symptoms })
  } catch (error) {
    console.error('Cycle day log error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/cycle/day-logs/:uid — recent per-day entries (uid-only read, sorted
// in memory to stay off composite indexes like the rest of the project)
router.get('/day-logs/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 90, 365)
    const cutoff = new Date(Date.now() - days * 86400000)
    const snap = await db.collection('cycleDayLogs').where('uid', '==', req.params.uid).get()
    const logs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(l => new Date(l.date) >= cutoff)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    res.json({ logs, count: logs.length, validFlow: VALID_FLOW, validSymptoms: VALID_SYMPTOMS })
  } catch (error) {
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
//
// The AI service can only compute a cycle day if it is told when the last
// period started. This route used to call /cycle/predict with no parameters,
// so the prediction came back as day 0 (no personalised model) or a fabricated
// "today minus 14 days" (model present) and then overwrote the correct stored
// values via the spread. That is why Home and the Cycle screen disagreed.
router.get('/today/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const doc = await db.collection('cycleLogs').doc(req.params.uid).get()
    if (!doc.exists) {
      return res.json({
        hasData: false, currentDay: 0, cycleLength: 28,
        vulnerabilityScore: 0, currentPhase: 'unknown',
        modelType: 'no_data', message: 'No cycle data yet'
      })
    }

    const data    = doc.data()
    const history = data.periodHistory || []
    const lastPeriod = history.length ? [...history].sort().pop() : null

    if (!lastPeriod) {
      return res.json({
        ...data, hasData: false, currentDay: 0,
        cycleLength: data.avgCycleLength || 28,
        vulnerabilityScore: 0, currentPhase: 'unknown', modelType: 'no_data'
      })
    }

    const predictRes = await ai.get(`/api/cycle/predict/${req.params.uid}`, {
      params:  { last_period: lastPeriod, avg_cycle: data.avgCycleLength || 28 },
      timeout: 8000
    }).catch(err => {
      console.warn('[cycleRoutes] LSTM predict failed, serving stored values:', err.message)
      return null
    })

    const merged = predictRes ? { ...data, ...predictRes.data } : { ...data }

    // Normalise the length field. The AI service returns predictedCycleLength;
    // both mobile screens read cycleLength and were silently defaulting to 28.
    res.json({
      ...merged,
      hasData:     true,
      lastPeriod,
      cycleLength: merged.predictedCycleLength || data.avgCycleLength || 28,
      modelType:   merged.modelType || 'population_fallback'
    })
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