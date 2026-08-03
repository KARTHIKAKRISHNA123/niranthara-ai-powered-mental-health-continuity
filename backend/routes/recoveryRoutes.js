// backend/routes/recoveryRoutes.js — the Recovery Engine's API surface.
//
// /api/outcomes answers "did what we did work". These endpoints answer the
// patient-facing half: "am I getting better, and what should I do today".

const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { requireSelfOrAssignedClinician, requireClinician } = require('../middleware/authorize')
const { generalLimiter } = require('../middleware/rateLimiter')
const { getRecovery, completeGoal, scoreHistory } = require('../services/recoveryService')

// GET /api/recovery/:uid — score + trajectory + residual symptoms + today's plan
router.get('/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    res.json(await getRecovery(req.params.uid))
  } catch (error) {
    console.error('[recovery] failed:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/recovery/:uid/history — stored daily scores for the trend line
router.get('/:uid/history', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 180)
    res.json({ uid: req.params.uid, history: await scoreHistory(req.params.uid, days) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/recovery/goal — { goalId, done }. Self only: a clinician ticking a
// patient's goal would corrupt the adherence signal the clinician then reads.
router.post('/goal', generalLimiter, verifyToken, async (req, res) => {
  try {
    const { goalId, done = true } = req.body
    if (!goalId) return res.status(400).json({ error: 'goalId is required' })

    const result = await completeGoal(req.user.uid, goalId, done !== false)
    if (result.error) return res.status(404).json(result)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/recovery/cohort/all — caseload recovery roll-up, worst first.
//
// The ordering is the point: this is a work queue, not a leaderboard. The
// patients who need a treatment review surface at the top on their own.
router.get('/cohort/all', generalLimiter, verifyToken, requireClinician, async (req, res) => {
  try {
    const patients = await db.collection('users')
      .where('assignedClinician', '==', req.user.uid).get()

    const rows = []
    for (const doc of patients.docs) {
      try {
        const r = await getRecovery(doc.id)
        rows.push({
          uid: doc.id,
          name: doc.data().name || 'Patient',
          riskLevel: doc.data().riskLevel || 'low',
          recoveryScore: r.recoveryScore.score,
          confidence: r.recoveryScore.confidence,
          trajectory: r.trajectory?.trajectory || 'insufficient_data',
          clinicalFlag: r.trajectory?.clinicalFlag || null,
          residualCount: (r.symptoms?.residual || []).length,
          planCompletion: r.plan.total ? Math.round(r.plan.completed / r.plan.total * 100) : null,
          engagementRate: r.effectiveness?.engagementRate ?? null,
        })
      } catch (e) {
        console.warn(`[recovery/cohort] skipped ${doc.id}:`, e.message)
      }
    }

    const flagged = rows.filter(r => r.clinicalFlag)
    res.json({
      patients: rows.sort((a, b) => (a.recoveryScore ?? 999) - (b.recoveryScore ?? 999)),
      cohort: {
        size: rows.length,
        scored: rows.filter(r => r.recoveryScore != null).length,
        // The triage list the problem statement asks for: engaged, adherent,
        // and not improving.
        needsTreatmentReview: flagged.map(r => ({ name: r.name, uid: r.uid, flag: r.clinicalFlag })),
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
