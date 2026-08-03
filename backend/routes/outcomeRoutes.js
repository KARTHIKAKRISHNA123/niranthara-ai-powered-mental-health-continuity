// backend/routes/outcomeRoutes.js
// Outcome measurement — the half of the loop that was missing.
//
// Risk prediction answers "who is deteriorating".
// These endpoints answer "did what we did about it work", which is the
// question that maps onto *incomplete symptom alleviation* in the problem
// statement, and the one a psychiatrist will ask first.

const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { requireSelfOrAssignedClinician, requireClinician } = require('../middleware/authorize')
const { generalLimiter } = require('../middleware/rateLimiter')
const { computeOutcomes, summarise, populationMeanDelta } = require('../services/outcomeService')

// GET /api/outcomes/:uid — effectiveness for one patient
router.get('/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const uid = req.params.uid
    const outcomes = await computeOutcomes(uid)
    const summary  = summarise(outcomes, await populationMeanDelta())
    res.json({
      uid,
      summary,
      outcomes: outcomes
        .sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt))
        .slice(0, 50),
    })
  } catch (error) {
    console.error('[outcomes] failed:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/outcomes/:uid/kpis — the clinical KPIs, one object, dashboard-ready
router.get('/:uid/kpis', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const uid = req.params.uid
    const [outcomes, userDoc, assessSnap, moodSnap] = await Promise.all([
      computeOutcomes(uid),
      db.collection('users').doc(uid).get(),
      db.collection('assessments').where('uid', '==', uid).get().catch(() => ({ docs: [] })),
      db.collection('moodLogs').where('uid', '==', uid).get().catch(() => ({ docs: [] })),
    ])
    const summary = summarise(outcomes, await populationMeanDelta())

    const phq = assessSnap.docs.map(d => d.data())
      .filter(a => a.type === 'phq9' && a.createdAt)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const moods = moodSnap.docs.map(d => d.data())
      .filter(m => m.createdAt).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    // Treatment response is the accepted clinical definition: >= 50% reduction
    // in PHQ-9 from baseline. Remission is < 5. Both stated, not invented.
    const firstPhq = phq[0]?.score ?? null
    const lastPhq  = phq[phq.length - 1]?.score ?? null
    const phqChange = (firstPhq != null && lastPhq != null) ? lastPhq - firstPhq : null
    const responded = (firstPhq != null && lastPhq != null && firstPhq > 0)
      ? (firstPhq - lastPhq) / firstPhq >= 0.5 : null

    // Loss of follow-up: days since the last patient-initiated contact.
    const lastContact = moods[moods.length - 1]?.createdAt || null
    const daysSinceContact = lastContact
      ? Math.floor((Date.now() - new Date(lastContact)) / 86400000) : null

    // Adherence to the check-in schedule over the last 30 days.
    const thirtyAgo = Date.now() - 30 * 86400000
    const recent = moods.filter(m => new Date(m.createdAt).getTime() >= thirtyAgo)
    const adherence = Math.min(100, Math.round((recent.length / 30) * 100))

    res.json({
      uid,
      symptomAlleviation: {
        baselinePhq9: firstPhq, latestPhq9: lastPhq, change: phqChange,
        treatmentResponse: responded,       // >= 50% PHQ-9 reduction
        remission: lastPhq != null ? lastPhq < 5 : null,
        assessmentCount: phq.length,
      },
      attrition: {
        checkInAdherence30d: adherence,
        checkInsLast30d: recent.length,
        engagementRate: summary.engagementRate,
        dropoutRisk: userDoc.exists ? (userDoc.data().dropoutProbability ?? null) : null,
      },
      lossOfFollowUp: {
        lastContact, daysSinceContact,
        atRisk: daysSinceContact != null && daysSinceContact >= 7,
      },
      interventionEffectiveness: summary,
    })
  } catch (error) {
    console.error('[outcomes/kpis] failed:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/outcomes/cohort/all — caseload roll-up for the clinician
router.get('/cohort/all', generalLimiter, verifyToken, requireClinician, async (req, res) => {
  try {
    const patients = await db.collection('users')
      .where('assignedClinician', '==', req.user.uid).get()
    const popMean = await populationMeanDelta()

    const rows = []
    for (const doc of patients.docs) {
      const u = doc.data()
      const outcomes = await computeOutcomes(doc.id)
      const s = summarise(outcomes, popMean)
      rows.push({
        uid: doc.id, name: u.name || 'Patient',
        riskLevel: u.riskLevel || 'low',
        interventions: s.delivered, measured: s.measured,
        engagementRate: s.engagementRate, meanMoodDelta: s.meanMoodDelta,
        bestIntervention: s.bestIntervention,
      })
    }
    const withData = rows.filter(r => r.meanMoodDelta != null)
    res.json({
      patients: rows.sort((a, b) => (a.meanMoodDelta ?? 99) - (b.meanMoodDelta ?? 99)),
      cohort: {
        size: rows.length,
        populationMeanMoodDelta: Math.round(popMean * 100) / 100,
        patientsWithMeasuredOutcomes: withData.length,
        // Who is receiving interventions that are not helping — the triage list.
        notImproving: withData.filter(r => r.meanMoodDelta <= 0).map(r => r.name),
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
