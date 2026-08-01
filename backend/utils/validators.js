// utils/validators.js
// Input validation helpers for all routes

/**
 * Validate mood check-in body
 * Returns { valid: true } or { valid: false, error: string }
 */
const validateMoodLog = (body) => {
  const { moodScore, energyLevel, anxietyLevel, sleepHours } = body

  if (moodScore !== undefined) {
    const v = Number(moodScore)
    if (isNaN(v) || v < 1 || v > 5)
      return { valid: false, error: 'moodScore must be 1–5' }
  }
  if (energyLevel !== undefined) {
    const v = Number(energyLevel)
    if (isNaN(v) || v < 1 || v > 10)
      return { valid: false, error: 'energyLevel must be 1–10' }
  }
  if (anxietyLevel !== undefined) {
    const v = Number(anxietyLevel)
    if (isNaN(v) || v < 1 || v > 10)
      return { valid: false, error: 'anxietyLevel must be 1–10' }
  }
  if (sleepHours !== undefined) {
    const v = Number(sleepHours)
    if (isNaN(v) || v < 0 || v > 24)
      return { valid: false, error: 'sleepHours must be 0–24' }
  }
  return { valid: true }
}

/**
 * Validate passive log body
 */
const validatePassiveLog = (body) => {
  const { stepsToday, sleepProxyHours, screenTimeMinutes } = body

  if (stepsToday !== undefined && (Number(stepsToday) < 0 || isNaN(Number(stepsToday))))
    return { valid: false, error: 'stepsToday must be a non-negative number' }
  if (sleepProxyHours !== undefined && (Number(sleepProxyHours) < 0 || Number(sleepProxyHours) > 24))
    return { valid: false, error: 'sleepProxyHours must be 0–24' }
  if (screenTimeMinutes !== undefined && (Number(screenTimeMinutes) < 0))
    return { valid: false, error: 'screenTimeMinutes must be non-negative' }
  return { valid: true }
}

/**
 * Validate GPS entropy body
 */
const validateGPSEntropy = (body) => {
  const { entropyScore } = body
  if (entropyScore === undefined)
    return { valid: false, error: 'entropyScore is required' }
  const v = Number(entropyScore)
  if (isNaN(v) || v < 0 || v > 100)
    return { valid: false, error: 'entropyScore must be 0–100' }
  return { valid: true }
}

/**
 * Validate period log body
 */
const validatePeriodLog = (body) => {
  const { periodStart } = body
  if (!periodStart)
    return { valid: false, error: 'periodStart is required' }
  if (isNaN(Date.parse(periodStart)))
    return { valid: false, error: 'periodStart must be a valid ISO date string' }
  return { valid: true }
}

/**
 * Validate chat message body
 */
const validateChatMessage = (body) => {
  const { message } = body
  if (!message || typeof message !== 'string' || message.trim().length === 0)
    return { valid: false, error: 'message is required and must be a non-empty string' }
  if (message.length > 2000)
    return { valid: false, error: 'message must be under 2000 characters' }
  return { valid: true }
}

/**
 * Validate user profile update body
 */
const validateProfileUpdate = (body) => {
  const { age, language, personaType, gender, tracksCycle } = body
  const VALID_LANGUAGES = ['ta', 'en']
  // 'women' and 'disabled' are retained so accounts seeded before the
  // gender/persona split keep validating.
  const VALID_PERSONAS  = ['general', 'student', 'elderly', 'caregiver', 'women', 'disabled']
  const VALID_GENDERS   = ['female', 'male', 'non_binary', 'prefer_not_to_say']

  if (age !== undefined && (Number(age) < 10 || Number(age) > 120))
    return { valid: false, error: 'age must be 10–120' }
  if (language && !VALID_LANGUAGES.includes(language))
    return { valid: false, error: `language must be one of: ${VALID_LANGUAGES.join(', ')}` }
  if (personaType && !VALID_PERSONAS.includes(personaType))
    return { valid: false, error: `personaType must be one of: ${VALID_PERSONAS.join(', ')}` }
  if (gender && !VALID_GENDERS.includes(gender))
    return { valid: false, error: `gender must be one of: ${VALID_GENDERS.join(', ')}` }
  if (tracksCycle !== undefined && typeof tracksCycle !== 'boolean')
    return { valid: false, error: 'tracksCycle must be a boolean' }
  return { valid: true }
}

module.exports = {
  validateMoodLog,
  validatePassiveLog,
  validateGPSEntropy,
  validatePeriodLog,
  validateChatMessage,
  validateProfileUpdate
}
