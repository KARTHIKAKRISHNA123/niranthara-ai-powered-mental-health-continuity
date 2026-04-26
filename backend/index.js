  // backend/index.js — Main server with all routes + scheduler

  const express = require('express')
  const cors    = require('cors')
  const helmet  = require('helmet')
  require('dotenv').config()

  const app  = express()
  const PORT = process.env.PORT || 5000

  app.use(helmet())
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Routes
  const authRoutes      = require('./routes/authRoutes')
  const moodRoutes      = require('./routes/moodRoutes')
  const cycleRoutes     = require('./routes/cycleRoutes')
  const chatRoutes      = require('./routes/chatRoutes')
  const jitaiRoutes     = require('./routes/jitaiRoutes')
  const clinicianRoutes = require('./routes/clinicianRoutes')
  const passiveRoutes   = require('./routes/passiveRoutes')
  const riskRoutes      = require('./routes/riskRoutes')

  app.use('/api/auth',      authRoutes)
  app.use('/api/mood',      moodRoutes)
  app.use('/api/cycle',     cycleRoutes)
  app.use('/api/chat',      chatRoutes)
  app.use('/api/jitai',     jitaiRoutes)
  app.use('/api/clinician', clinicianRoutes)
  app.use('/api/passive',   passiveRoutes)
  app.use('/api/risk',      riskRoutes)

  // Health
  app.get('/', (req, res) => res.json({ app: 'Niranthara API v2.0', status: 'running', architecture: 'ML-first — zero hardcoding', team: 'Anna University Regional Campus, Tirunelveli' }))
  app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'backend', uptime: process.uptime() }))

  // Firebase connection test
  app.get('/api/firebase-test', async (req, res) => {
    try {
      const { db } = require('./config/firebase')
      await db.collection('health').doc('connection').set({ tested: true, timestamp: new Date().toISOString() })
      res.json({ status: 'Firebase connected successfully' })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // 404
  app.use((req, res) => res.status(404).json({ error: 'Route not found' }))
  app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ error: 'Internal server error' }) })

  app.listen(PORT, () => {
    console.log(`Niranthara backend running on port ${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV}`)
    
    // Start JITAI cron scheduler
    require('./services/jitaiScheduler')
    console.log('JITAI scheduler started')

    // Start Daily Escalation Cron Job
    const { checkEscalations } = require('./services/escalationCron')
    setInterval(checkEscalations, 24 * 60 * 60 * 1000) // Run every 24 hours
    console.log('Daily Loss-of-Follow-Up Escalation Job scheduled')
  })
