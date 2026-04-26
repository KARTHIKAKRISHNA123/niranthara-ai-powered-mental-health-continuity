// services/notificationService.js
// FCM push notifications via Firebase Admin SDK

const { fcm } = require('../config/firebase')

const INTERVENTION_MESSAGES = {
  breathing: {
    title: '🌿 Take a breath',
    body:  'A short breathing exercise is ready for you'
  },
  cbt_reframe: {
    title: '💜 Gentle check-in',
    body:  'How are you feeling right now? Take a moment for yourself'
  },
  grounding: {
    title: '🌱 Grounding moment',
    body:  'A quick grounding exercise can help bring calm'
  },
  cycle_aware: {
    title: '🌙 Cycle support',
    body:  'Your body may need extra care today. We\'re here'
  },
  gentle_nudge: {
    title: '☀️ Niranthara check-in',
    body:  'How are you doing today?'
  },
  crisis_check: {
    title: '💙 We\'re here for you',
    body:  'Tap to talk — support is available right now'
  }
}

/**
 * Send JITAI intervention push notification via FCM.
 * Notification text is never mental-health-specific in the title (privacy).
 */
const sendJITAINotification = async (fcmToken, interventionType, customTitle, customBody) => {
  const template = INTERVENTION_MESSAGES[interventionType] || INTERVENTION_MESSAGES.gentle_nudge
  const title    = customTitle || template.title
  const body     = customBody  || template.body

  const message = {
    token: fcmToken,
    notification: { title, body },
    data: {
      interventionType,
      screen:    'InterventionScreen',
      timestamp: new Date().toISOString()
    },
    android: {
      priority: interventionType === 'crisis_check' ? 'high' : 'normal',
      notification: { channelId: 'Niranthara_support' }
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound:     'default',
          badge:     1,
          'content-available': 1
        }
      }
    }
  }

  return fcm.send(message)
}

/**
 * Send crisis alert notification to clinician.
 */
const sendClinicianCrisisAlert = async (clinicianFcmToken, patientName, riskScore) => {
  if (!clinicianFcmToken) return

  return fcm.send({
    token: clinicianFcmToken,
    notification: {
      title: '⚠️ Patient needs attention',
      body:  `${patientName || 'A patient'} — risk score: ${(riskScore * 100).toFixed(0)}%`
    },
    data: { screen: 'Alerts', type: 'crisis' },
    android: { priority: 'high' }
  })
}

module.exports = { sendJITAINotification, sendClinicianCrisisAlert }
