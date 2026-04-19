const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')

router.post('/register', verifyToken, async (req, res) => {
  try {
    const { uid, email, name } = req.body
    await db.collection('users').doc(uid).set({
      uid,
      email:           email || '',
      name:            name  || '',
      createdAt:       new Date().toISOString(),
      profileComplete: false
    })
    res.status(201).json({ message: 'User registered successfully', uid })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/me', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get()
    if (!doc.exists) return res.status(404).json({ error: 'User not found' })
    res.json({ user: doc.data() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router