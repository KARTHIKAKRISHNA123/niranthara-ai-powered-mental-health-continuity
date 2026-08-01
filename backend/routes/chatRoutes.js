// routes/chatRoutes.js
// Full context injection + NVIDIA model chain + encrypted chat logs

const express = require('express')
const router  = express.Router()
const { db }  = require('../config/firebase')
const verifyToken = require('../middleware/verifyToken')
const { requireSelfOrAssignedClinician } = require('../middleware/authorize')
const { chatLimiter, generalLimiter } = require('../middleware/rateLimiter')
const { encrypt, decrypt } = require('../utils/encryption')
const { validateChatMessage } = require('../utils/validators')

const { ai } = require('../utils/aiClient')

// POST /api/chat/message — Full NLP → NVIDIA model chain, context-aware response
router.post('/message', chatLimiter, verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const { message, language, history } = req.body

    const validation = validateChatMessage(req.body)
    if (!validation.valid) return res.status(400).json({ error: validation.error })

    // Sanitise prior turns from the client into the shape the AI service expects
    const safeHistory = Array.isArray(history)
      ? history
          .filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
          .slice(-8)
          .map(t => ({ role: t.role, content: t.content.slice(0, 2000) }))
      : []

    // Pull user context (risk level, cycle vulnerability, recent mood)
    const [userDoc, cycleDoc, recentMoodSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('cycleLogs').doc(uid).get(),
      db.collection('moodLogs').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(1).get()
    ])

    const user          = userDoc.exists  ? userDoc.data()  : {}
    const cycle         = cycleDoc.exists ? cycleDoc.data() : {}
    const lastMood      = !recentMoodSnap.empty ? recentMoodSnap.docs[0].data() : {}

    const contextPayload = {
      message,
      // Reply in the language the user TYPED (ai-service detects Tamil script /
      // Tanglish per message). Profile language here made English questions get
      // Tamil answers — and pushed replies outside the English guardrail regex.
      language:           language || 'en',
      uid,
      cycle_vulnerability:  cycle.vulnerabilityScore   || 0,
      mood_score:           lastMood.moodScore         || 3,
      risk_level:           user.riskLevel             || 'low',
      emotion_detected:     lastMood.nlpResults?.emotionLabel    || 'neutral',
      sentiment_score:      lastMood.nlpResults?.sentimentScore  || 0.5,
      history:              safeHistory
    }

    const aiRes = await ai.post(`/api/chat`, contextPayload, { timeout: 45000 })
    const aiData = aiRes.data

    // Encrypt user message before storing
    const encryptedMsg = encrypt(message)

    const logRef = await db.collection('chatLogs').add({
      uid,
      userMessage:      encryptedMsg,  // AES-256-GCM encrypted
      aiReply:          aiData.reply,
      language:         contextPayload.language,
      isCrisis:         aiData.isCrisis || false,
      crisisProbability: aiData.crisisProbability || 0,
      emotionDetected:  aiData.emotionDetected || 'neutral',
      sentimentScore:   aiData.sentimentScore || 0.5,
      cyclePhase:       cycle.currentPhase || 'unknown',
      moodScore:        lastMood.moodScore || 3,
      riskLevel:        user.riskLevel || 'low',
      suggestions:      aiData.suggestions || [],
      // Fallback label only when the AI service returned no tag at all — must
      // not name a model that is no longer in the chain, since this value is
      // persisted to chatLogs and surfaced as provenance.
      modelUsed:        aiData.modelUsed || 'unknown',
      responseTimeMs:   aiData.responseTimeMs || 0,
      offlineSyncId:    req.body.offlineSyncId || null,
      timestamp:        new Date().toISOString()
    })

    // If crisis detected in chat, create clinician alert
    if (aiData.crisisProbability > 0.75) {
      await db.collection('clinicianAlerts').add({
        patientUid: uid, clinicianUid: user.assignedClinician || '',
        type: 'crisis', riskScore: user.riskScore || 0,
        crisisProb: aiData.crisisProbability, triggerFactors: ['Crisis language detected in chat'],
        resolved: false, resolvedAt: null, timestamp: new Date().toISOString()
      })
    }

    res.json({
      reply:             aiData.reply,
      isCrisis:          aiData.isCrisis || false,
      crisisProbability: aiData.crisisProbability || 0,
      emotionDetected:   aiData.emotionDetected,
      suggestions:       aiData.suggestions || [],
      modelUsed:         aiData.modelUsed,
      logId:             logRef.id
    })
  } catch (error) {
    console.error('Chat error:', error.message)
    // Graceful fallback response (never keyword-based — just a warm static message)
    res.json({
      reply:     "I'm here with you. It sounds like you might be going through something difficult. Would you like to tell me more about how you're feeling right now?",
      isCrisis:  false,
      modelUsed: 'fallback',
      suggestions: []
    })
  }
})

// POST /api/chat/voice — Sarvam STT → NLP → NVIDIA model chain
router.post('/voice', chatLimiter, verifyToken, async (req, res) => {
  try {
    const { audioBase64, language } = req.body
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 is required' })

    // Sarvam STT transcription via AI service
    const sttRes = await ai.post(`/api/chat/transcribe`, {
      audioBase64, language: language || 'ta'
    }, { timeout: 20000 })

    const transcribedText = sttRes.data.transcript
    if (!transcribedText || transcribedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not transcribe audio' })
    }

    // Forward to regular message handler logic
    req.body.message = transcribedText
    req.body.language = sttRes.data.detectedLanguage || language || 'ta'

    // Re-use the message route logic by calling directly
    const uid = req.user.uid
    const contextPayload = {
      message: transcribedText,
      language: req.body.language,
      uid
    }

    const aiRes = await ai.post(`/api/chat`, contextPayload, { timeout: 45000 })
    const encryptedMsg = encrypt(transcribedText)

    await db.collection('chatLogs').add({
      uid, userMessage: encryptedMsg, aiReply: aiRes.data.reply,
      language: req.body.language, isCrisis: aiRes.data.isCrisis || false,
      crisisProbability: aiRes.data.crisisProbability || 0,
      inputType: 'voice', transcript: transcribedText,
      timestamp: new Date().toISOString()
    })

    res.json({ reply: aiRes.data.reply, transcript: transcribedText, isCrisis: aiRes.data.isCrisis || false })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/chat/history/:uid
router.get('/history/:uid', generalLimiter, verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const snap = await db.collection('chatLogs')
      .where('uid', '==', req.params.uid)
      .orderBy('timestamp', 'desc').limit(50).get()
    // Return without encrypted userMessage for security
    const history = snap.docs.map(d => {
      const { userMessage, ...safe } = d.data()
      return { id: d.id, ...safe }
    })
    res.json({ history })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/chat/thread/:uid — caller's OWN conversation, decrypted, chronological.
// Self-only: raw chat content is private — not exposed even to the assigned clinician.
// Used by the mobile app to restore context across restarts (continuity).
router.get('/thread/:uid', generalLimiter, verifyToken, async (req, res) => {
  try {
    if (req.user.uid !== req.params.uid) {
      return res.status(403).json({ error: 'Forbidden — chat content is private' })
    }
    // Fetch by uid only and sort in memory — same composite-index avoidance
    // as the dashboard (the indexed query 500'd without console setup).
    const snap = await db.collection('chatLogs')
      .where('uid', '==', req.params.uid).get()

    const docs = snap.docs
      .map(d => d.data())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))  // chronological
      .slice(-30)

    const turns = []
    docs.forEach(data => {
      const userText = data.userMessage ? decrypt(data.userMessage) : ''
      if (userText)     turns.push({ role: 'user',      content: userText,     time: data.timestamp })
      if (data.aiReply) turns.push({ role: 'assistant', content: data.aiReply, time: data.timestamp })
    })
    res.json({ turns })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/chat/clear/:uid
router.delete('/clear/:uid', verifyToken, requireSelfOrAssignedClinician, async (req, res) => {
  try {
    const snap = await db.collection('chatLogs').where('uid', '==', req.params.uid).get()
    const batch = db.batch()
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    res.json({ message: `Cleared ${snap.size} chat records` })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router