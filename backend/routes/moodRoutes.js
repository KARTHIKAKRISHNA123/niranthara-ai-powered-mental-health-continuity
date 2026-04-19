const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')

router.post('/log', verifyToken, async (req, res) => {
  try {
    const { moodScore, energyLevel, anxietyLevel, sleepHours, journalText, symptoms } = req.body
    const logRef = await db.collection('moodLogs').add({
      uid:          req.user.uid,
      moodScore:    moodScore    || 3,
      energyLevel:  energyLevel  || 5,
      anxietyLevel: anxietyLevel || 5,
      sleepHours:   sleepHours   || 7,
      journalText:  journalText  || '',
      symptoms:     symptoms     || [],
      date:         new Date().toISOString(),
      createdAt:    new Date().toISOString()
    })
    res.status(201).json({ message: 'Mood logged successfully', id: logRef.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/weekly/:uid', verifyToken, async (req, res) => {
  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const snapshot = await db.collection('moodLogs')
      .where('uid', '==', req.params.uid)
      .where('createdAt', '>=', sevenDaysAgo.toISOString())
      .orderBy('createdAt', 'desc')
      .get()
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    res.json({ logs })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router