  // backend/index.js — Main server with all routes + scheduler

  const express = require('express')
  const cors    = require('cors')
  const helmet  = require('helmet')
  const fs      = require('fs')
  require('dotenv').config()

  // ── Fail fast on missing config — a half-configured server that boots and
  // then 500s on every encrypted write is worse than one that refuses to start.
  const missing = []
  if (!process.env.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY (backend/.env)')
  if (!fs.existsSync(require('path').join(__dirname, 'serviceAccountKey.json'))) missing.push('serviceAccountKey.json')
  if (missing.length) {
    console.error(`FATAL: missing required config: ${missing.join(', ')}`)
    process.exit(1)
  }
  if (!process.env.AI_SERVICE_URL) console.warn('AI_SERVICE_URL not set — defaulting to http://localhost:8000')

  // ── Process-level safety nets: log-and-continue on unhandled rejections
  // (a background FCM/cron failure must never kill the crisis pipeline);
  // log-and-exit on truly unknown exceptions.
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason?.message || reason)
  })
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err.stack || err)
    process.exit(1)
  })

  const app  = express()
  const PORT = process.env.PORT || 5000

  app.use(helmet())
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Request log: method, path, status, duration. No bodies, no PII — journals
  // and messages must never reach logs.
  app.use((req, res, next) => {
    const t0 = Date.now()
    res.on('finish', () => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t0}ms`)
    })
    next()
  })

  // Routes
  const authRoutes      = require('./routes/authRoutes')
  const moodRoutes      = require('./routes/moodRoutes')
  const cycleRoutes     = require('./routes/cycleRoutes')
  const chatRoutes      = require('./routes/chatRoutes')
  const jitaiRoutes     = require('./routes/jitaiRoutes')
  const clinicianRoutes = require('./routes/clinicianRoutes')
  const passiveRoutes   = require('./routes/passiveRoutes')
  const riskRoutes      = require('./routes/riskRoutes')
  const biometricRoutes = require('./routes/biometricRoutes')
  const assessmentRoutes = require('./routes/assessmentRoutes')
  const googleHealthRoutes = require('./routes/googleHealthRoutes')

  app.use('/api/auth',      authRoutes)
  app.use('/api/mood',      moodRoutes)
  app.use('/api/cycle',     cycleRoutes)
  app.use('/api/chat',      chatRoutes)
  app.use('/api/jitai',     jitaiRoutes)
  app.use('/api/clinician', clinicianRoutes)
  app.use('/api/passive',   passiveRoutes)
  app.use('/api/passive',   biometricRoutes)   // /api/passive/biometric-sync
  app.use('/api/risk',      riskRoutes)
  app.use('/api/assessments', assessmentRoutes)
  app.use('/api/google-health', googleHealthRoutes)  // cloud wearable path (Fitbit via Google Health API)

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

  const server = app.listen(PORT, () => {
    console.log(`Niranthara backend running on port ${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV}`)

    // Start JITAI cron scheduler
    require('./services/jitaiScheduler')
    console.log('JITAI scheduler started')

    // Start 15-minute escalation cron (crisis prob + loss-of-follow-up)
    const { startEscalationCron } = require('./services/escalationCron')
    startEscalationCron()
  })

  // Graceful shutdown: release the port on Ctrl+C/SIGTERM so restarts never
  // hit "address already in use" (zombie listeners were a repeated failure).
  const shutdown = (signal) => {
    console.log(`${signal} received — closing server`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 5000).unref()
  }
  process.on('SIGINT',  () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
