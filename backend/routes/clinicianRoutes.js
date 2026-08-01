// routes/clinicianRoutes.js
// Clinician dashboard backend — per Build Guide §25

const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { requireClinician, requireSelfOrAssignedClinician } = require('../middleware/authorize')
const { generalLimiter } = require('../middleware/rateLimiter')

const { ai } = require('../utils/aiClient')

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

    // uid-only reads + in-memory filter/sort: same composite-index avoidance as
    // the dashboard and /summary. A missing index here 404'd healthy patients.
    const recent = (snap) => snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(l => l.createdAt && new Date(l.createdAt) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const [userDoc, cycleDoc, moodSnap, passiveSnap, jitaiSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('cycleLogs').doc(uid).get(),
      db.collection('moodLogs').where('uid', '==', uid).get().catch(() => ({ docs: [] })),
      db.collection('passiveLogs').where('uid', '==', uid).get().catch(() => ({ docs: [] })),
      db.collection('jitaiLogs').where('uid', '==', uid).get().catch(() => ({ docs: [] }))
    ])

    if (!userDoc.exists) return res.status(404).json({ error: 'Patient not found' })

    const moodLogs = recent(moodSnap).map(({ journalText, ...safe }) => safe)

    res.json({
      user:        userDoc.data(),
      cycle:       cycleDoc.exists ? cycleDoc.data() : null,
      moodLogs,
      passiveLogs: recent(passiveSnap),
      jitaiLogs:   jitaiSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
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

    // Fetch by uid only, then filter/sort in memory. The range+orderBy form
    // needs a composite index that does not exist in this project, and because
    // this sat inside Promise.all with no catch, a missing index failed the
    // whole route and reported it as "the AI service may be offline".
    const [userDoc, moodSnap, alertSnap, assessSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('moodLogs').where('uid', '==', uid).get().catch(e => {
        console.warn('[clinicianRoutes] moodLogs read failed:', e.message)
        return { docs: [] }
      }),
      db.collection('clinicianAlerts').where('patientUid', '==', uid).get().catch(() => ({ docs: [] })),
      db.collection('assessments').where('uid', '==', uid).get().catch(() => ({ docs: [] }))
    ])

    const user = userDoc.exists ? userDoc.data() : {}
    const logs = moodSnap.docs
      .map(d => d.data())
      .filter(l => l.createdAt && new Date(l.createdAt) >= thirtyAgo)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
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

    // Nothing to summarise is a distinct state from a failure — say so rather
    // than asking the model to narrate an empty window.
    if (!logs.length && !assessments.length) {
      return res.json({
        summary: `No check-ins or assessments recorded for ${stats.patientName} in the last 30 days. There is nothing to summarise yet — the loss-of-follow-up signal is itself the clinical finding here.`,
        modelUsed: 'no_data',
        stats,
        generatedAt
      })
    }

    const summaryRes = await ai.post(`/api/chat/summary`, stats, { timeout: 45000 })
    res.json({
      summary:   summaryRes.data.summary,
      modelUsed: summaryRes.data.modelUsed,
      stats,
      generatedAt
    })
  } catch (error) {
    // Report what actually failed. The old copy blamed the AI service for
    // every error, including Firestore ones, which sent debugging the wrong way.
    const reason = error.response
      ? `AI service returned ${error.response.status}`
      : error.code === 'ECONNABORTED'
        ? 'AI service timed out after 45s'
        : error.code === 'ECONNREFUSED'
          ? `AI service unreachable at ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`
          : error.message
    console.warn('[clinicianRoutes] summary failed:', reason)
    res.json({
      summary: `AI summary unavailable — ${reason}. Review the charts below manually.`,
      modelUsed: 'fallback_backend_error',
      error: reason,
      generatedAt
    })
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