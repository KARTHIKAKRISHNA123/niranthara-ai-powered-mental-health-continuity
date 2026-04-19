const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5000

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
})

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(limiter)

app.get('/', (req, res) => {
  res.json({
    app:     'Nirantara API',
    version: '1.0.0',
    status:  'running',
    team:    'Anna University Regional Campus, Tirunelveli'
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    status:    'OK',
    timestamp: new Date().toISOString(),
    service:   'backend',
    uptime:    process.uptime()
  })
})

const authRoutes      = require('./routes/authRoutes')
const moodRoutes      = require('./routes/moodRoutes')
const cycleRoutes     = require('./routes/cycleRoutes')
const chatRoutes      = require('./routes/chatRoutes')
const jitaiRoutes     = require('./routes/jitaiRoutes')
const clinicianRoutes = require('./routes/clinicianRoutes')

app.use('/api/auth',      authRoutes)
app.use('/api/mood',      moodRoutes)
app.use('/api/cycle',     cycleRoutes)
app.use('/api/chat',      chatRoutes)
app.use('/api/jitai',     jitaiRoutes)
app.use('/api/clinician', clinicianRoutes)

// ✅ firebase-test MUST be here — before the 404 handler
app.get('/api/firebase-test', async (req, res) => {
  try {
    const { db } = require('./config/firebase')
    await db.collection('health').doc('connection').set({
      tested:    true,
      timestamp: new Date().toISOString()
    })
    res.json({ status: 'Firebase connected successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ❌ 404 handler MUST be last — it catches everything that didn't match above
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Nirantara backend running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV}`)
})