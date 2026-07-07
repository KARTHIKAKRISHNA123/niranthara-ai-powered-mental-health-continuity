// routes/clinicianRoutes.js
// Clinician dashboard backend — per Build Guide §25

const express = require('express')
const router  = express.Router()
const axios   = require('axios')
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { requireClinician, requireSelfOrAssignedClinician } = require('../middleware/authorize')
const { generalLimiter } = require('../middleware/rateLimiter')

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

// GET /api/clinician/patients — All patients sorted by XGBoost risk_score
router.get('/patients', generalLimiter, verifyToken, requireClinician, async (req, res) => {
  try {
    const snap = await db.collection('users')
      .where('assignedClinician', '==', req.user.uid)
      .get()
    const patients = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)) // Sorted by XGBoost score
    res.json({ patients, count: patients.length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/clinician/patient/:uid — Full data + NLP results
router.get('/patient/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const uid = req.params.uid

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [userDoc, cycleDoc, moodSnap, passiveSnap, jitaiSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('cycleLogs').doc(uid).get(),
      db.collection('moodLogs').where('uid', '==', uid).where('createdAt', '>=', thirtyDaysAgo.toISOString()).orderBy('createdAt', 'desc').get(),
      db.collection('passiveLogs').where('uid', '==', uid).where('createdAt', '>=', thirtyDaysAgo.toISOString()).orderBy('createdAt', 'desc').get(),
      db.collection('jitaiLogs').where('uid', '==', uid).orderBy('timestamp', 'desc').limit(10).get()
    ])

    if (!userDoc.exists) return res.status(404).json({ error: 'Patient not found' })

    const moodLogs = moodSnap.docs.map(d => { const { journalText, ...safe } = d.data(); return { id: d.id, ...safe } })

    res.json({
      user:        userDoc.data(),
      cycle:       cycleDoc.exists ? cycleDoc.data() : null,
      moodLogs,
      passiveLogs: passiveSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      jitaiLogs:   jitaiSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/clinician/summary/:uid — AI narrative summary (Minimax via NVIDIA)
// Sends structured 30-day aggregates only — never raw journal/chat text.
router.get('/summary/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  const generatedAt = new Date().toISOString()
  try {
    const uid = req.params.uid
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)

    const [userDoc, moodSnap, alertSnap, assessSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('moodLogs').where('uid', '==', uid).where('createdAt', '>=', thirtyAgo.toISOString()).orderBy('createdAt', 'desc').get(),
      db.collection('clinicianAlerts').where('patientUid', '==', uid).get().catch(() => ({ docs: [] })),
      db.collection('assessments').where('uid', '==', uid).get().catch(() => ({ docs: [] }))
    ])

    const user = userDoc.exists ? userDoc.data() : {}
    const logs = moodSnap.docs.map(d => d.data())
    const avg  = (arr, f) => arr.length ? arr.reduce((s, l) => s + (f(l) || 0), 0) / arr.length : null

    // Mood trend: last 7 days vs first 7 of the window
    const oldest = logs.slice(-7), newest = logs.slice(0, 7)
    const oldAvg = avg(oldest, l => l.moodScore), newAvg = avg(newest, l => l.moodScore)
    const moodTrend = (oldAvg != null && newAvg != null)
      ? `${oldAvg.toFixed(1)} -> ${newAvg.toFixed(1)} (${newAvg > oldAvg + 0.3 ? 'improving' : newAvg < oldAvg - 0.3 ? 'declining' : 'stable'})`
      : null

    const assessments = assessSnap.docs.map(d => d.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const latest = (type) => {
      const a = assessments.find(x => x.type === type)
      return a ? `${a.score}/${a.maxScore} (${a.severity})` : null
    }

    const stats = {
      patientName:        user.name || 'Patient',
      logCount:           logs.length,
      avgMood:            avg(logs, l => l.moodScore),
      moodTrend,
      riskLevel:          user.riskLevel || 'low',
      riskScore:          user.riskScore || 0,
      avgDivergence:      avg(logs, l => l.moodSentimentDivergence),
      crisisEvents:       logs.filter(l => l.nlpResults?.crisisProbability > 0.5).length,
      openAlerts:         alertSnap.docs.filter(d => d.data().resolved === false).length,
      topFactors:         user.topFactors || logs[0]?.topFactors || [],
      lastPhq9:           latest('phq9'),
      lastGad7:           latest('gad7'),
      avgSleep:           avg(logs, l => l.sleepHours),
      cycleVulnerability: logs[0]?.cycleVulnerability ?? null
    }

    const summaryRes = await axios.post(`${AI_URL}/api/chat/summary`, stats, { timeout: 45000 })
    res.json({ summary: summaryRes.data.summary, modelUsed: summaryRes.data.modelUsed, generatedAt })
  } catch (error) {
    console.warn('[clinicianRoutes] summary failed:', error.message)
    res.json({ summary: 'AI summary unavailable — the AI service may be offline. Review the charts below manually.', modelUsed: 'fallback_backend_error', generatedAt })
  }
})

// POST /api/clinician/flag/:uid — Manual flag
router.post('/flag/:uid', verifyToken, requireClinician, async (req, res) => {
  try {
    const { reason } = req.body
    await db.collection('clinicianAlerts').add({
      patientUid: req.params.uid, clinicianUid: req.user.uid,
      type: 'manual_flag', riskScore: 0, crisisProb: 0,
      triggerFactors: [reason || 'Manual clinician flag'],
      resolved: false, resolvedAt: null, timestamp: new Date().toISOString()
    })
    res.json({ message: 'Patient flagged' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/clinician/alerts — Unresolved alerts
// Fetch by clinicianUid only, filter/sort in memory — same composite-index
// avoidance as the dashboard (the indexed query 500'd in testing).
router.get('/alerts', generalLimiter, verifyToken, requireClinician, async (req, res) => {
  try {
    const snap = await db.collection('clinicianAlerts')
      .where('clinicianUid', '==', req.user.uid)
      .get()
    const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.resolved === false)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    res.json({ alerts, count: alerts.length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/clinician/resolve-alert/:id
router.put('/resolve-alert/:id', verifyToken, requireClinician, async (req, res) => {
  try {
    await db.collection('clinicianAlerts').doc(req.params.id).update({
      resolved: true, resolvedAt: new Date().toISOString()
    })
    res.json({ message: 'Alert resolved' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router