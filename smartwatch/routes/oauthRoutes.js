// smartwatch/routes/oauthRoutes.js
// Google OAuth 2.0 — connect + callback
// Tokens stored AES-256-GCM encrypted in Firestore users.googleHealthTokens

require('dotenv').config()
const express = require('express')
const axios   = require('axios')
const crypto  = require('crypto')
const { db }  = require('../config/firebase')
const router  = express.Router()

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Google Health API OAuth scopes — all health-related biometric data we need
const SCOPES = [
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.body_temperature.read',
  'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
  'https://www.googleapis.com/auth/fitness.reproductive_health.read'
].join(' ')

// ── AES-256-GCM helpers (matches backend/utils/encryption.js pattern exactly) ──
const getKey = () => {
  const hexKey = process.env.ENCRYPTION_KEY
  if (!hexKey || hexKey.length !== 64) throw new Error('ENCRYPTION_KEY must be 64-char hex')
  return Buffer.from(hexKey, 'hex')
}

const encrypt = (text) => {
  if (!text) return ''
  const KEY    = getKey()
  const iv     = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

// ── GET /smartwatch/auth/connect ──────────────────────────────────────────────
// Called from mobile app: Linking.openURL('http://localhost:5001/smartwatch/auth/connect?uid=USER_UID')
router.get('/auth/connect', (req, res) => {
  const { uid } = req.query
  if (!uid) return res.status(400).json({ error: 'uid query parameter is required' })

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state:         uid   // pass uid through state param to recover in callback
  })

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`
  console.log(`[BiometricSync] oauth-connect: redirecting uid=${uid} to Google at ${new Date().toISOString()}`)
  res.redirect(authUrl)
})

// ── GET /smartwatch/auth/callback ─────────────────────────────────────────────
// Google redirects here after user grants consent
router.get('/auth/callback', async (req, res) => {
  const { code, state: uid, error } = req.query

  if (error) {
    console.error(`[BiometricSync] oauth-error: user denied consent at ${new Date().toISOString()}`)
    return res.redirect('niranthara://smartwatch/error')
  }

  if (!code || !uid) {
    return res.status(400).json({ error: 'Missing code or uid from OAuth callback' })
  }

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post(GOOGLE_TOKEN_URL, new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
      grant_type:    'authorization_code'
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

    const { access_token, refresh_token, expires_in } = tokenRes.data

    // Encrypt tokens before storing — never store plaintext credentials
    const googleHealthTokens = {
      accessToken:  encrypt(access_token),
      refreshToken: encrypt(refresh_token),
      expiresAt:    Date.now() + (expires_in * 1000),
      connectedAt:  new Date().toISOString()
    }

    await db.collection('users').doc(uid).update({
      googleHealthTokens,
      fitbitConnected: true,
      updatedAt: new Date().toISOString()
    })

    console.log(`[BiometricSync] oauth-callback: tokens stored for uid=${uid} at ${new Date().toISOString()}`)

    // Redirect back to mobile app via deep link
    res.redirect('niranthara://smartwatch/connected')
  } catch (err) {
    console.error(`[BiometricSync] oauth-callback-error: ${err.message} at ${new Date().toISOString()}`)
    res.redirect('niranthara://smartwatch/error')
  }
})

module.exports = router
