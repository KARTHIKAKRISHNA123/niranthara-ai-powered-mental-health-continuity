// routes/googleHealthRoutes.js
// Connect a real wearable (Fitbit Charge 6, Pixel Watch, Wear OS) through the
// Google Health API instead of on-device Health Connect.
//
// Flow:
//   mobile → GET  /api/google-health/connect   → consent URL, opened in browser
//   Google → GET  /api/google-health/callback  → stores encrypted refresh token
//   mobile → POST /api/google-health/sync      → pulls 24h, feeds biometric-sync
//
// The callback is deliberately unauthenticated (Google redirects a browser to
// it with no Authorization header). It is protected by a signed, single-use,
// short-lived `state` value minted by /connect for an already-authenticated uid.

const express = require('express')
const crypto  = require('crypto')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { generalLimiter } = require('../middleware/rateLimiter')
const gh = require('../services/googleHealthClient')
const { processBiometricSync } = require('./biometricRoutes')

// state = uid.expiry.hmac — signed with ENCRYPTION_KEY so a forged callback
// cannot attach someone else's Google account to a Niranthara uid.
const STATE_TTL_MS = 10 * 60 * 1000

function signState(uid) {
  const exp  = Date.now() + STATE_TTL_MS
  const body = `${uid}.${exp}`
  const mac  = crypto.createHmac('sha256', process.env.ENCRYPTION_KEY).update(body).digest('hex')
  return Buffer.from(`${body}.${mac}`).toString('base64url')
}

function verifyState(state) {
  try {
    const [uid, exp, mac] = Buffer.from(state, 'base64url').toString().split('.')
    if (!uid || !exp || !mac) return null
    if (Date.now() > Number(exp)) return null
    const expected = crypto.createHmac('sha256', process.env.ENCRYPTION_KEY).update(`${uid}.${exp}`).digest('hex')
    // timingSafeEqual throws on length mismatch — guard first.
    if (mac.length !== expected.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
    return uid
  } catch { return null }
}

const notConfigured = (res) => res.status(503).json({
  error: 'Google Health API is not configured on this server',
  hint:  'Set GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET and GOOGLE_HEALTH_REDIRECT_URI in backend/.env',
})

// GET /api/google-health/status
router.get('/status', verifyToken, async (req, res) => {
  try {
    res.json({
      configured: gh.isConfigured(),
      connected:  gh.isConfigured() ? await gh.isConnected(req.user.uid) : false,
      scopes:     gh.SCOPES,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/google-health/connect — returns the consent URL for the app to open
router.get('/connect', verifyToken, async (req, res) => {
  if (!gh.isConfigured()) return notConfigured(res)
  try {
    res.json({ consentUrl: gh.buildConsentUrl(signState(req.user.uid)) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/google-health/callback — Google redirects the browser here
router.get('/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query
  const page = (title, body, ok) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui,-apple-system,sans-serif;background:#FBF7F2;color:#2C2826;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px">
<div style="max-width:380px;text-align:center">
  <div style="width:56px;height:56px;border-radius:50%;background:${ok ? '#D6EAD9' : '#FDEAE6'};margin:0 auto 20px;line-height:56px;font-size:26px">${ok ? '&#10003;' : '!'}</div>
  <h2 style="font-weight:600;margin:0 0 8px">${title}</h2>
  <p style="color:#8A8076;line-height:1.6;margin:0">${body}</p>
</div></body>`

  if (oauthError) return res.status(400).send(page('Connection cancelled', 'You can close this tab and try again from the app.', false))
  if (!gh.isConfigured()) return res.status(503).send(page('Not configured', 'Google Health credentials are missing on the server.', false))

  const uid = verifyState(state)
  if (!uid) return res.status(400).send(page('Link expired', 'This connection link is no longer valid. Start again from the Niranthara app.', false))
  if (!code) return res.status(400).send(page('Missing authorisation', 'Google did not return an authorisation code.', false))

  try {
    const tokens = await gh.exchangeCode(code)
    if (!tokens.refresh_token) {
      return res.status(400).send(page(
        'Reconnect needed',
        'Google did not issue a refresh token. Remove Niranthara at myaccount.google.com/permissions, then connect again.',
        false
      ))
    }
    await gh.saveTokens(uid, tokens, tokens.scope)
    res.send(page('Google Health connected', 'Your watch data can now sync to Niranthara. You can close this tab and return to the app.', true))
  } catch (error) {
    console.error('[googleHealth] callback failed:', error.message)
    res.status(500).send(page('Connection failed', error.message, false))
  }
})

// POST /api/google-health/sync — pull the last 24h and run it through the
// existing biometric pipeline (same scoring, alerting and dashboard path).
router.post('/sync', generalLimiter, verifyToken, async (req, res) => {
  if (!gh.isConfigured()) return notConfigured(res)
  try {
    const uid = req.user.uid
    const biometrics = await gh.fetchBiometrics(uid, Number(req.body?.windowHours) || 24)

    const anySignal = Object.values(biometrics.availability).some(Boolean)
    if (!anySignal) {
      return res.status(200).json({
        synced: false,
        biometrics,
        message: 'Google Health returned no records for the last 24 hours. Open the Fitbit app and let it sync, then try again.',
      })
    }

    // Same deviation maths, same >= 2-signal alert gate, same XGBoost re-score
    // as a phone sync — no parallel implementation to keep in step.
    const result = await processBiometricSync(uid, biometrics)
    res.json({ synced: true, biometrics, ...result })
  } catch (error) {
    if (error.code === 'NOT_CONNECTED') {
      return res.status(409).json({ error: error.message, action: 'connect' })
    }
    console.error('[googleHealth] sync failed:', error.message)
    res.status(502).json({ error: error.message })
  }
})

// DELETE /api/google-health/disconnect
router.delete('/disconnect', verifyToken, async (req, res) => {
  try {
    await gh.disconnect(req.user.uid)
    res.json({ message: 'Google Health disconnected' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
