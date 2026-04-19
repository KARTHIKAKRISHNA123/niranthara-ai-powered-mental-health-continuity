const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')

const getCyclePhase = (cycleDay) => {
  if (cycleDay >= 1  && cycleDay <= 5)  return { phase: 'menstrual',   isHighRisk: false }
  if (cycleDay >= 6  && cycleDay <= 13) return { phase: 'follicular',  isHighRisk: false }
  if (cycleDay >= 14 && cycleDay <= 16) return { phase: 'ovulation',   isHighRisk: false }
  if (cycleDay >= 17 && cycleDay <= 21) return { phase: 'luteal',      isHighRisk: false }
  if (cycleDay >= 22 && cycleDay <= 28) return { phase: 'late_luteal', isHighRisk: true  }
  return { phase: 'unknown', isHighRisk: false }
}

router.post('/log-period', verifyToken, async (req, res) => {
  try {
    const { periodStart, avgCycleLength } = req.body
    const startDate  = new Date(periodStart)
    const today      = new Date()
    const cycleDay   = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1
    const phaseData  = getCyclePhase(cycleDay)
    const nextPeriod = new Date(startDate)
    nextPeriod.setDate(nextPeriod.getDate() + (avgCycleLength || 28))

    await db.collection('cycleLogs').doc(req.user.uid).set({
      uid:            req.user.uid,
      periodStart,
      avgCycleLength: avgCycleLength || 28,
      currentDay:     cycleDay,
      currentPhase:   phaseData.phase,
      isHighRisk:     phaseData.isHighRisk,
      nextPeriodDate: nextPeriod.toISOString(),
      updatedAt:      new Date().toISOString()
    })

    res.json({
      message:      'Cycle logged successfully',
      currentDay:   cycleDay,
      currentPhase: phaseData.phase,
      isHighRisk:   phaseData.isHighRisk,
      nextPeriod:   nextPeriod.toISOString()
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/today/:uid', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('cycleLogs').doc(req.params.uid).get()
    if (!doc.exists) {
      return res.json({ currentDay: 0, currentPhase: 'unknown', isHighRisk: false, message: 'No cycle data yet' })
    }
    res.json(doc.data())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router