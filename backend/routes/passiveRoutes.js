// routes/passiveRoutes.js — NEW per Build Guide §12

const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { passiveLimiter, generalLimiter } = require('../middleware/rateLimiter')
const { validatePassiveLog, validateGPSEntropy } = require('../utils/validators')
const baselineService = require('../services/baselineService')

// POST /api/passive/log — Passive snapshot with baseline deviation scores
router.post('/log', passiveLimiter, verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const {
      stepsToday, sleepProxyHours, screenTimeMinutes, nightScreenMinutes,
      appOpenCount, chatSessionCount, notifResponseTimeAvg, socialConnectivityScore,
      permissionLevel, offlineSyncId, checkinCompleted
    } = req.body

    const validation = validatePassiveLog(req.body)
    if (!validation.valid) return res.status(400).json({ error: validation.error })

    // Get user's personal baseline
    const userDoc = await db.collection('users').doc(uid).get()
    const baseline = userDoc.exists ? (userDoc.data().baselineData || null) : null

    // Compute deviation scores from personal baseline (not population thresholds)
    const stepsDeviationScore = baseline
      ? Math.min(Math.max((baseline.avgSteps - (stepsToday || 0)) / Math.max(baseline.avgSteps, 1), 0), 1)
      : 0.3  // Default during calibration

    const sleepDeviationScore = baseline
      ? Math.min(Math.max((baseline.avgSleep - (sleepProxyHours || 7)) / Math.max(baseline.avgSleep, 1), 0), 1)
      : 0.3

    const logData = {
      uid,
      date:                 new Date().toISOString(),
      stepsToday:           stepsToday            || 0,
      stepsBaseline:        baseline?.avgSteps     || 0,
      stepsDeviationScore,
      gpsEntropy:           0,  // Populated by gps-entropy endpoint
      gpsEntropyBaseline:   baseline?.avgGpsEntropy || 3,
      gpsDeviationScore:    0,
      sleepProxyHours:      sleepProxyHours       || 0,
      sleepBaseline:        baseline?.avgSleep     || 7,
      sleepDeviationScore,
      screenTimeMinutes:    screenTimeMinutes     || 0,
      nightScreenMinutes:   nightScreenMinutes    || 0,
      appOpenCount:         appOpenCount          || 0,
      chatSessionCount:     chatSessionCount      || 0,
      notifResponseTimeAvg: notifResponseTimeAvg  || 0,
      socialConnectivityScore: socialConnectivityScore || 0.5,
      checkinCompleted:     checkinCompleted      ?? false,
      permissionLevel:      permissionLevel       || 'minimal',
      offlineSyncId:        offlineSyncId         || null,
      createdAt:            new Date().toISOString()
    }

    const ref = await db.collection('passiveLogs').add(logData)

    // Check if baseline needs to be computed (after 14 days)
    await baselineService.checkAndUpdateBaseline(uid)

    res.status(201).json({ message: 'Passive log saved', id: ref.id, stepsDeviationScore, sleepDeviationScore })
  } catch (error) {
    console.error('Passive log error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/passive/gps-entropy — GPS entropy score (no raw coordinates ever stored)
router.post('/gps-entropy', passiveLimiter, verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const { entropyScore } = req.body

    const validation = validateGPSEntropy(req.body)
    if (!validation.valid) return res.status(400).json({ error: validation.error })

    // Get user baseline for GPS entropy
    const userDoc = await db.collection('users').doc(uid).get()
    const baseline = userDoc.exists ? userDoc.data().baselineData : null
    const entropyBaseline = baseline?.avgGpsEntropy || 3

    const deviationScore = Math.min(Math.max((entropyBaseline - entropyScore) / Math.max(entropyBaseline, 1), 0), 1)

    // Find today's passive log and update it
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const snap = await db.collection('passiveLogs')
      .where('uid', '==', uid)
      .where('createdAt', '>=', today.toISOString())
      .orderBy('createdAt', 'desc').limit(1).get()

    if (!snap.empty) {
      await snap.docs[0].ref.update({
        gpsEntropy:        entropyScore,
        gpsDeviationScore: deviationScore
      })
    } else {
      // Create minimal passive log with just GPS data
      await db.collection('passiveLogs').add({
        uid, gpsEntropy: entropyScore, gpsDeviationScore: deviationScore,
        gpsEntropyBaseline: entropyBaseline, createdAt: new Date().toISOString()
      })
    }

    res.json({ message: 'GPS entropy saved (no coordinates stored)', entropyScore, deviationScore })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/passive/sync-batch — Process offline queue from mobile
router.post('/sync-batch', verifyToken, async (req, res) => {
  try {
    const { items } = req.body
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })

    const results = []
    for (const item of items.slice(0, 50)) {  // Max 50 per batch
      try {
        // Check for duplicate by offlineSyncId
        if (item.offlineSyncId) {
          const dup = await db.collection('passiveLogs').where('offlineSyncId', '==', item.offlineSyncId).limit(1).get()
          if (!dup.empty) { results.push({ id: item.offlineSyncId, status: 'duplicate_skipped' }); continue }
        }
        const ref = await db.collection('passiveLogs').add({ ...item, uid: req.user.uid, syncedToFirestore: true })
        results.push({ id: ref.id, offlineSyncId: item.offlineSyncId, status: 'synced' })
      } catch (e) {
        results.push({ offlineSyncId: item.offlineSyncId, status: 'error', error: e.message })
      }
    }

    res.json({ message: `Processed ${results.length} items`, results })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/passive/summary/:uid — 7-day passive summary for Home screen widgets
router.get('/summary/:uid', generalLimiter, verifyToken, async (req, res) => {
  try {
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7)
    const snap = await db.collection('passiveLogs')
      .where('uid', '==', req.params.uid)
      .where('createdAt', '>=', sevenAgo.toISOString())
      .orderBy('createdAt', 'desc').get()

    const logs = snap.docs.map(d => d.data())
    const avg = (arr, key) => {
      const vals = arr.map(l => Number(l[key] || 0)).filter(v => v > 0)
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }

    res.json({
      avgSteps:             Math.round(avg(logs, 'stepsToday')),
      avgSleepHours:        Math.round(avg(logs, 'sleepProxyHours') * 10) / 10,
      avgGpsEntropy:        Math.round(avg(logs, 'gpsEntropy') * 10) / 10,
      avgStepsDeviation:    Math.round(avg(logs, 'stepsDeviationScore') * 100) / 100,
      avgSleepDeviation:    Math.round(avg(logs, 'sleepDeviationScore') * 100) / 100,
      avgGpsDeviation:      Math.round(avg(logs, 'gpsDeviationScore') * 100) / 100,
      checkinRate:          logs.length ? logs.filter(l => l.checkinCompleted).length / logs.length : 0,
      daysLogged:           logs.length,
      latest:               logs[0] || null,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/passive/today/:uid
router.get('/today/:uid', generalLimiter, verifyToken, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const snap = await db.collection('passiveLogs')
      .where('uid', '==', req.params.uid)
      .where('createdAt', '>=', today.toISOString())
      .orderBy('createdAt', 'desc').limit(1).get()

    if (snap.empty) return res.json({ message: 'No passive data for today', date: today.toISOString() })
    res.json({ ...snap.docs[0].data(), id: snap.docs[0].id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/passive/update-baseline/:uid
router.put('/update-baseline/:uid', verifyToken, async (req, res) => {
  try {
    const result = await baselineService.computeAndSaveBaseline(req.params.uid)
    res.json({ message: 'Baseline recomputed', baseline: result })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
