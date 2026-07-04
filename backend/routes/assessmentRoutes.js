// routes/assessmentRoutes.js — PHQ-9 / GAD-7 validated clinical instruments
// Scores computed server-side (single source of truth); item answers stored
// alongside the score so clinicians can review individual items.

const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { requireSelfOrAssignedClinician } = require('../middleware/authorize')
const { generalLimiter } = require('../middleware/rateLimiter')

const INSTRUMENTS = {
  phq9: {
    items: 9,
    max: 27,
    bands: [
      [0, 4,  'minimal'], [5, 9, 'mild'], [10, 14, 'moderate'],
      [15, 19, 'moderately severe'], [20, 27, 'severe'],
    ],
  },
  gad7: {
    items: 7,
    max: 21,
    bands: [
      [0, 4, 'minimal'], [5, 9, 'mild'], [10, 14, 'moderate'], [15, 21, 'severe'],
    ],
  },
}

const severityFor = (instrument, score) =>
  INSTRUMENTS[instrument].bands.find(([lo, hi]) => score >= lo && score <= hi)[2]

// POST /api/assessments — { type: 'phq9'|'gad7', answers: [0-3, ...] }
router.post('/', generalLimiter, verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const { type, answers } = req.body

    const spec = INSTRUMENTS[type]
    if (!spec) return res.status(400).json({ error: 'type must be phq9 or gad7' })
    if (!Array.isArray(answers) || answers.length !== spec.items ||
        answers.some(a => !Number.isInteger(a) || a < 0 || a > 3)) {
      return res.status(400).json({ error: `answers must be ${spec.items} integers 0-3` })
    }

    const score    = answers.reduce((s, a) => s + a, 0)
    const severity = severityFor(type, score)
    // PHQ-9 item 9 asks about self-harm thoughts — any non-zero answer is a
    // clinical flag regardless of total score (standard PHQ-9 protocol).
    const selfHarmFlag = type === 'phq9' && answers[8] > 0

    const docRef = await db.collection('assessments').add({
      uid, type, answers, score, severity, selfHarmFlag,
      maxScore: spec.max,
      createdAt: new Date().toISOString(),
    })

    // Keep the latest score on the user doc so dashboard triage reads it
    // without an extra query.
    await db.collection('users').doc(uid).update({
      [`last_${type}`]: { score, severity, at: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    }).catch(() => {})

    if (selfHarmFlag) {
      const userDoc  = await db.collection('users').doc(uid).get()
      const userData = userDoc.exists ? userDoc.data() : {}
      await db.collection('clinicianAlerts').add({
        patientUid:      uid,
        patientName:     userData.name || 'Patient',
        clinicianUid:    userData.assignedClinician || '',
        type:            'assessment_self_harm',
        riskScore:       0,
        crisisProb:      0,
        triggerFactors:  [`PHQ-9 item 9 answered "${answers[8]}" — self-harm ideation reported`],
        assessmentScore: score,
        resolved:        false,
        resolvedAt:      null,
        timestamp:       new Date().toISOString(),
      })
    }

    res.status(201).json({ id: docRef.id, score, severity, maxScore: spec.max, selfHarmFlag })
  } catch (error) {
    console.error('Assessment error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/assessments/:uid?type=phq9 — history, newest first
router.get('/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    // Fetch by uid only and filter/sort client-side — same composite-index
    // avoidance tradeoff as the dashboard (documented in commit 585a25e).
    const snap = await db.collection('assessments').where('uid', '==', req.params.uid).get()
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (req.query.type) items = items.filter(a => a.type === req.query.type)
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json({ assessments: items.slice(0, 50), count: items.length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
