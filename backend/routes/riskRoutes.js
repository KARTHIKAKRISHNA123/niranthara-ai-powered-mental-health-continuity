// routes/riskRoutes.js — XGBoost risk score + SHAP explainability per Build Guide §12

const express = require('express')
const router  = express.Router()
const axios   = require('axios')
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { generalLimiter } = require('../middleware/rateLimiter')

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

const buildFeatureVector = async (uid, db) => {
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)
  const sevenAgo  = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7)

  const [userDoc, moodSnap, passiveSnap, cycleDoc] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('moodLogs').where('uid', '==', uid).where('createdAt', '>=', sevenAgo.toISOString()).orderBy('createdAt', 'desc').get(),
    db.collection('passiveLogs').where('uid', '==', uid).where('createdAt', '>=', sevenAgo.toISOString()).orderBy('createdAt', 'desc').get(),
    db.collection('cycleLogs').doc(uid).get()
  ])

  const moods   = moodSnap.docs.map(d => d.data())
  const passive = passiveSnap.docs.map(d => d.data())
  const user    = userDoc.exists ? userDoc.data() : {}
  const cycle   = cycleDoc.exists ? cycleDoc.data() : {}

  const avg = (arr, key) => arr.length ? arr.reduce((s, l) => s + (Number(l[key]) || 0), 0) / arr.length : 0

  return {
    uid,
    moodScore:               avg(moods, 'moodScore') || 3,
    sleepHours:              avg(moods, 'sleepHours') || 7,
    anxietyLevel:            avg(moods, 'anxietyLevel') || 5,
    sentimentScore:          avg(moods.map(m => m.nlpResults || {}), 'sentimentScore') || 0.5,
    emotionLabel:            moods[0]?.nlpResults?.emotionLabel || 'neutral',
    crisisProbability:       Math.max(...moods.map(m => m.nlpResults?.crisisProbability || 0), 0),
    cycleVulnerability:      cycle.vulnerabilityScore || 0,
    moodSentimentDivergence: avg(moods, 'moodSentimentDivergence') || 0,
    passiveLogs:             passive
  }
}

// GET /api/risk/score/:uid — XGBoost risk + SHAP factors
router.get('/score/:uid', generalLimiter, verifyToken, async (req, res) => {
  try {
    const features = await buildFeatureVector(req.params.uid, db)
    const riskRes  = await axios.post(`${AI_URL}/api/predict/risk`, features, { timeout: 12000 })
    res.json({ ...riskRes.data, uid: req.params.uid, computedAt: new Date().toISOString() })
  } catch (error) {
    res.status(503).json({ error: 'Risk computation unavailable', message: error.message })
  }
})

// GET /api/risk/history/:uid — 30-day risk trajectory
router.get('/history/:uid', generalLimiter, verifyToken, async (req, res) => {
  try {
    const ago = new Date(); ago.setDate(ago.getDate() - 30)
    const snap = await db.collection('moodLogs')
      .where('uid', '==', req.params.uid)
      .where('createdAt', '>=', ago.toISOString())
      .orderBy('createdAt', 'asc').get()

    const trajectory = snap.docs.map(d => {
      const data = d.data()
      return { date: data.createdAt, riskScore: data.riskScore || 0, riskLevel: data.riskLevel || 'low', topFactors: data.topFactors || [], cycleVulnerability: data.cycleVulnerability || 0 }
    })
    res.json({ trajectory, uid: req.params.uid })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/risk/explain/:uid — Full SHAP explanation
router.get('/explain/:uid', generalLimiter, verifyToken, async (req, res) => {
  try {
    const features = await buildFeatureVector(req.params.uid, db)
    const explainRes = await axios.post(`${AI_URL}/api/predict/explain`, features, { timeout: 15000 })
    res.json(explainRes.data)
  } catch (error) {
    res.status(503).json({ error: 'Explanation unavailable', message: error.message })
  }
})

module.exports = router
