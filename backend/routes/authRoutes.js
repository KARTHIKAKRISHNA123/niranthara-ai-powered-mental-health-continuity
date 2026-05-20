// routes/authRoutes.js
// All auth endpoints per Build Guide §12

const express = require('express')
const router  = express.Router()
const { db, auth } = require('../config/firebase')
const verifyToken  = require('../middleware/verifyToken')
const { authLimiter } = require('../middleware/rateLimiter')
const { validateProfileUpdate } = require('../utils/validators')

// POST /api/auth/register
// Register new user with full schema and persona type
router.post('/register', authLimiter, verifyToken, async (req, res) => {
  try {
    const uid  = req.user.uid
    const {
      name, age, language, personaType,
      conditions, therapistContact, emergencyContact
    } = req.body

    const validation = validateProfileUpdate({ age, language, personaType })
    if (!validation.valid) return res.status(400).json({ error: validation.error })

    const existing = await db.collection('users').doc(uid).get()
    if (existing.exists) {
      return res.status(409).json({ error: 'User already registered' })
    }

    const userDoc = {
      uid,
      name:               name              || '',
      age:                age               || null,
      language:           language          || 'en',
      personaType:        personaType       || 'general',
      conditions:         conditions        || [],
      therapistContact:   therapistContact  || '',
      emergencyContact:   emergencyContact  || '',
      caregiverContact:   '',
      assignedClinician:  '',
      permissions: {
        steps:         false,
        location:      false,
        notifications: false
      },
      accessibilityMode:   'standard',
      accessibilityOptions: {
        voiceNavigation: false,
        screenReaderOptimized: false,
        highContrast: false,
        switchAccess: false
      },
      supervisionMode:     false,
      caseConferenceOptIn:  false,
      baselineCalibrated:  false,
      baselineData:        null,
      riskLevel:           'low',
      riskScore:           0.0,
      dropoutProbability:  0.0,
      dropoutRiskLevel:    'low',
      profileComplete:     false,
      role:                'user',
      createdAt:           new Date().toISOString(),
      updatedAt:           new Date().toISOString()
    }

    await db.collection('users').doc(uid).set(userDoc)
    res.status(201).json({ message: 'User registered successfully', uid })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/auth/me
// Get user profile + baseline data
router.get('/me', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get()
    if (!doc.exists) return res.status(404).json({ error: 'User not found' })

    const cycleDoc = await db.collection('cycleLogs').doc(req.user.uid).get()
    res.json({
      user:  doc.data(),
      cycle: cycleDoc.exists ? cycleDoc.data() : null
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/auth/update-profile
// Update user profile fields
router.put('/update-profile', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const {
      name, age, language, personaType,
      conditions, therapistContact, emergencyContact,
      caregiverContact, permissions, accessibilityMode, profileComplete,
      lastPeriodDate, supervisionMode, caseConferenceOptIn, accessibilityOptions
    } = req.body

    const validation = validateProfileUpdate({ age, language, personaType })
    if (!validation.valid) return res.status(400).json({ error: validation.error })

    const update = { updatedAt: new Date().toISOString() }
    if (name               !== undefined) update.name               = name
    if (age                !== undefined) update.age                = age
    if (language           !== undefined) update.language           = language
    if (personaType        !== undefined) update.personaType        = personaType
    if (conditions         !== undefined) update.conditions         = conditions
    if (therapistContact   !== undefined) update.therapistContact   = therapistContact
    if (emergencyContact   !== undefined) update.emergencyContact   = emergencyContact
    if (caregiverContact   !== undefined) update.caregiverContact   = caregiverContact
    if (permissions        !== undefined) update.permissions        = permissions
    if (accessibilityMode  !== undefined) update.accessibilityMode  = accessibilityMode
    if (accessibilityOptions !== undefined) update.accessibilityOptions = accessibilityOptions
    if (supervisionMode    !== undefined) update.supervisionMode    = supervisionMode
    if (caseConferenceOptIn !== undefined) update.caseConferenceOptIn = caseConferenceOptIn
    if (profileComplete    !== undefined) update.profileComplete    = profileComplete
    if (lastPeriodDate     !== undefined) update.lastPeriodDate     = lastPeriodDate

    await db.collection('users').doc(uid).update(update)
    res.json({ message: 'Profile updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/auth/update-baseline
// Recompute personal baseline (called by baselineService after calibration)
router.put('/update-baseline', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const {
      avgSteps, avgSleep, avgGpsEntropy,
      stdSteps, stdSleep
    } = req.body

    const baselineData = {
      avgSteps:    avgSteps    || 0,
      avgSleep:    avgSleep    || 7,
      avgGpsEntropy: avgGpsEntropy || 3,
      stdSteps:    stdSteps    || 1,
      stdSleep:    stdSleep    || 1,
      computedAt:  new Date().toISOString()
    }

    await db.collection('users').doc(uid).update({
      baselineData,
      baselineCalibrated: true,
      updatedAt: new Date().toISOString()
    })

    res.json({ message: 'Baseline updated successfully', baselineData })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/auth/delete-account
// DPDP Act 2023 — full data deletion across all collections
router.delete('/delete-account', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const collections = [
      'users', 'moodLogs', 'cycleLogs', 'passiveLogs',
      'chatLogs', 'jitaiLogs', 'clinicianAlerts'
    ]

    const batch = db.batch()

    for (const col of ['users', 'cycleLogs']) {
      const ref = db.collection(col).doc(uid)
      batch.delete(ref)
    }

    for (const col of ['moodLogs', 'passiveLogs', 'chatLogs', 'jitaiLogs', 'clinicianAlerts']) {
      const snap = await db.collection(col).where('uid', '==', uid).get()
      snap.docs.forEach(doc => batch.delete(doc.ref))
      const snap2 = await db.collection(col).where('patientUid', '==', uid).get()
      snap2.docs.forEach(doc => batch.delete(doc.ref))
    }

    await batch.commit()
    await auth.deleteUser(uid)

    res.json({ message: 'Account and all data deleted successfully (DPDP compliance)' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/auth/export-data
// DPDP Act 2023 — right to data portability
router.get('/export-data', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid
    const [userDoc, cycleDoc, moods, passive, chats, jitai] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('cycleLogs').doc(uid).get(),
      db.collection('moodLogs').where('uid', '==', uid).orderBy('createdAt', 'desc').get(),
      db.collection('passiveLogs').where('uid', '==', uid).orderBy('createdAt', 'desc').get(),
      db.collection('chatLogs').where('uid', '==', uid).orderBy('timestamp', 'desc').limit(100).get(),
      db.collection('jitaiLogs').where('uid', '==', uid).orderBy('timestamp', 'desc').get(),
    ])

    // Note: journalText is encrypted — returned as-is (user can decrypt)
    res.json({
      exportedAt: new Date().toISOString(),
      user:       userDoc.data(),
      cycle:      cycleDoc.exists ? cycleDoc.data() : null,
      moodLogs:   moods.docs.map(d => ({ id: d.id, ...d.data() })),
      passiveLogs:passive.docs.map(d => ({ id: d.id, ...d.data() })),
      chatLogs:   chats.docs.map(d => ({ id: d.id, ...d.data() })),
      jitaiLogs:  jitai.docs.map(d => ({ id: d.id, ...d.data() })),
      note: 'journalText and userMessage fields are AES-256-GCM encrypted for your privacy'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/auth/update-profile
// Saves persona selection + onboardingComplete flag (called from Onboarding screen)
router.patch('/update-profile', verifyToken, async (req, res) => {
  try {
    const uid     = req.user.uid
    const allowed = ['persona', 'onboardingComplete', 'language', 'name', 'age']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    updates.updatedAt = new Date().toISOString()
    await db.collection('users').doc(uid).update(updates)
    const updated = await db.collection('users').doc(uid).get()
    res.json({ success: true, user: { uid, ...updated.data() } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router