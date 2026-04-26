// middleware/rateLimiter.js
// Per-route rate limiters using express-rate-limit

const rateLimit = require('express-rate-limit')

const makeMsg = (type) => ({
  error: `Too many ${type} requests. Please try again later.`
})

// Auth routes — strict (sign-up/login abuse prevention)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      10,
  message:  makeMsg('authentication')
})

// AI-heavy routes (mood log triggers full NLP pipeline)
const nlpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  makeMsg('NLP pipeline')
})

// Chat — allow more messages per session
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      60,
  message:  makeMsg('chat')
})

// Passive log (high-frequency sensor data)
const passiveLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max:      30,
  message:  makeMsg('passive log')
})

// General API (read endpoints)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  makeMsg('API')
})

module.exports = {
  authLimiter,
  nlpLimiter,
  chatLimiter,
  passiveLimiter,
  generalLimiter
}
