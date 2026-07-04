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

// GET /api/clinician/summary/:uid — Gemma AI narrative summary
router.get('/summary/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const uid = req.params.uid
    const [userDoc, moodSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('moodLogs').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(7).get()
    ])

    const user      = userDoc.exists ? userDoc.data() : {}
    const moodLogs  = moodSnap.docs.map(d => d.data())
    const avgMood   = moodLogs.length ? moodLogs.reduce((s, l) => s + l.moodScore, 0) / moodLogs.length : 3

    const summaryRes = await axios.post(`${AI_URL}/api/chat`, {
      message: `Generate a 2-3 sentence clinical summary for a patient with risk level ${user.riskLevel || 'low'}, average mood ${avgMood.toFixed(1)}/5 over the past week. Top risk factors: ${(user.riskScore || 0).toFixed(2)} risk score. Be concise and clinical.`,
      language: 'en',
      uid,
      mood_score: avgMood,
      risk_level: user.riskLevel || 'low'
    }, { timeout: 30000 })

    res.json({ summary: summaryRes.data.reply, generatedAt: new Date().toISOString() })
  } catch (error) {
    res.json({ summary: `Patient has a ${req.query.riskLevel || 'low'} risk profile. Manual review recommended.`, generatedAt: new Date().toISOString() })
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
router.get('/alerts', generalLimiter, verifyToken, requireClinician, async (req, res) => {
  try {
    const snap = await db.collection('clinicianAlerts')
      .where('clinicianUid', '==', req.user.uid)
      .where('resolved', '==', false)
      .orderBy('timestamp', 'desc').get()
    const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
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