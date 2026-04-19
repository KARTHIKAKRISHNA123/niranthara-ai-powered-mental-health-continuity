const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')

const COOLDOWN_HOURS = 4

const evaluateJITAI = (moodScore, cyclePhase, stepsToday, isInChat) => {
  if (isInChat) return null
  if (moodScore <= 2 && cyclePhase === 'late_luteal' && stepsToday < 4000)
    return { type: 'cbt_reframe',  priority: 'high'   }
  if (moodScore <= 2 && stepsToday < 3000)
    return { type: 'breathing',    priority: 'medium' }
  if (cyclePhase === 'late_luteal' && moodScore <= 3)
    return { type: 'cycle_aware',  priority: 'medium' }
  if (moodScore <= 1)
    return { type: 'crisis_check', priority: 'urgent' }
  return null
}

router.post('/evaluate/:uid', verifyToken, async (req, res) => {
  try {
    const { moodScore, cyclePhase, stepsToday, isInChat } = req.body
    const uid = req.params.uid

    const lastDoc = await db.collection('jitaiLogs')
      .where('uid', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get()

    if (!lastDoc.empty) {
      const lastTime   = new Date(lastDoc.docs[0].data().timestamp)
      const hoursSince = (new Date() - lastTime) / (1000 * 60 * 60)
      if (hoursSince < COOLDOWN_HOURS) {
        return res.json({
          shouldIntervene:  false,
          reason:           'Cooldown active',
          nextAvailableIn:  Math.round(COOLDOWN_HOURS - hoursSince)
        })
      }
    }

    const intervention = evaluateJITAI(moodScore, cyclePhase, stepsToday, isInChat)
    if (!intervention) return res.json({ shouldIntervene: false })

    await db.collection('jitaiLogs').add({
      uid,
      interventionType: intervention.type,
      priority:         intervention.priority,
      timestamp:        new Date().toISOString()
    })

    res.json({ shouldIntervene: true, intervention })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router