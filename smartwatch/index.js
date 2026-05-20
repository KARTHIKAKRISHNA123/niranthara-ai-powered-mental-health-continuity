// smartwatch/index.js
// Express entry point — port 5001
// Independent of backend (port 5000) and AI service (port 8000)

require('dotenv').config()
const express     = require('express')
const helmet      = require('helmet')
const cors        = require('cors')
const oauthRoutes = require('./routes/oauthRoutes')
const { startBiometricCron } = require('./services/biometricCron')

const app  = express()
const PORT = process.env.PORT || 5001

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet())
app.use(cors())
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/smartwatch', oauthRoutes)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    service: 'niranthara-smartwatch',
    status:  'running',
    port:    PORT,
    time:    new Date().toISOString()
  })
})

// ── Start server + cron ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[BiometricSync] start: Smartwatch service running on port ${PORT} at ${new Date().toISOString()}`)
  startBiometricCron()
})
