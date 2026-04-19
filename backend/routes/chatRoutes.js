const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const axios   = require('axios')
const verifyToken = require('../middleware/verifyToken')

router.post('/message', verifyToken, async (req, res) => {
  try {
    const { message, language } = req.body
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/chat`,
      { message, language: language || 'en', uid: req.user.uid }
    )
    await db.collection('chatLogs').add({
      uid:       req.user.uid,
      userMsg:   message,
      aiReply:   aiResponse.data.reply,
      language:  language || 'en',
      timestamp: new Date().toISOString()
    })
    res.json({ reply: aiResponse.data.reply, isCrisis: aiResponse.data.isCrisis || false })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/history/:uid', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('chatLogs')
      .where('uid', '==', req.params.uid)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    res.json({ history })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router