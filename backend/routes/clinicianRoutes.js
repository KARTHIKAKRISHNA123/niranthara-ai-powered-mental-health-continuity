const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')

router.get('/patients', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .where('assignedClinician', '==', req.user.uid)
      .get()
    const patients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    res.json({ patients })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/patient/:uid', verifyToken, async (req, res) => {
  try {
    const [userDoc, cycleDoc, recentMoods] = await Promise.all([
      db.collection('users').doc(req.params.uid).get(),
      db.collection('cycleLogs').doc(req.params.uid).get(),
      db.collection('moodLogs')
        .where('uid', '==', req.params.uid)
        .orderBy('createdAt', 'desc')
        .limit(30)
        .get()
    ])
    res.json({
      user:        userDoc.data(),
      cycle:       cycleDoc.data(),
      recentMoods: recentMoods.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router