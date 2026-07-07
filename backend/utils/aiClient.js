// utils/aiClient.js — the single boundary between the backend and the AI service.
//
// Every ML/NLP call goes through this instance so there is exactly one place
// for the base URL, the default timeout, and (when scale demands it) retries,
// circuit breaking, and request tracing. Route files must not construct
// AI-service URLs themselves.
//
// Timeout policy: 15s default covers all classifier/model endpoints; the LLM
// paths (chat, summary) override per-call to 45s — that ceiling must stay
// above the AI service's full model-chain worst case (12s + 25s + overhead).

const axios = require('axios')

const ai = axios.create({
  baseURL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  timeout: 15000,
})

module.exports = { ai }
