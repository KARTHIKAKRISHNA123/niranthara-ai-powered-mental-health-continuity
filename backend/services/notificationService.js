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

  return sendByTokenType(fcmToken, message, { title, body, interventionType })
}

/**
 * Expo push transport.
 *
 * The mobile app is Expo and registers an **Expo** push token
 * (`ExponentPushToken[xxx]`). Firebase Admin cannot deliver to those — it speaks
 * FCM, and an Expo token is not an FCM registration token. Sending one to
 * `fcm.send()` fails with `registration-token-not-registered`, which is exactly
 * why patient pushes had never arrived even on accounts that had a token.
 *
 * Expo's push service is a plain HTTPS POST with no SDK and no credentials, so
 * this is the shortest correct path for an Expo client.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'

const isExpoToken = (token) =>
  typeof token === 'string' && token.startsWith('ExponentPushToken[')

const sendExpoPush = async (token, { title, body, data = {}, priority = 'normal' }) => {
  const res = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{ to: token, title, body, data, sound: 'default', priority, channelId: 'default' }]),
  })
  const payload = await res.json().catch(() => null)
  const ticket  = payload?.data?.[0]

  // Expo returns HTTP 200 with a per-message error ticket. Treating that as
  // success is how a silent delivery failure hides for weeks.
  if (ticket?.status === 'error') {
    const err = new Error(`Expo push rejected: ${ticket.message}`)
    err.expoErrorCode = ticket.details?.error   // e.g. DeviceNotRegistered
    throw err
  }
  return ticket
}

/** Route by token shape so both transports keep working during migration. */
const sendByTokenType = async (token, fcmMessage, { title, body, interventionType }) => {
  if (isExpoToken(token)) {
    return sendExpoPush(token, {
      title,
      body,
      data: { interventionType, screen: 'InterventionScreen' },
      priority: interventionType === 'crisis_check' ? 'high' : 'normal',
    })
  }
  return fcm.send(fcmMessage)
}

/**
 * Daily check-in reminder — the attrition lever.
 *
 * Attrition is not usually a decision; it is a patient who quietly stops
 * opening the app. A check-in is also the measurement the whole outcome loop
 * depends on, so a missed check-in costs us the data AND the patient.
 * Deliberately generic wording: a lock-screen preview is visible to whoever
 * picks up the phone, so it must never disclose a mental-health context.
 */
const sendCheckInReminder = async (token, { daysSinceLastCheckIn = 0 } = {}) => {
  if (!token) return null

  const body = daysSinceLastCheckIn >= 3
    ? 'It has been a few days. A 30-second check-in helps us stay useful to you.'
    : 'A quick 30-second check-in keeps your insights accurate.'

  return sendByTokenType(
    token,
    {
      token,
      notification: { title: 'Niranthara', body },
      data: { screen: 'Home', type: 'checkin_reminder' },
      android: { priority: 'normal', notification: { channelId: 'default' } },
    },
    { title: 'Niranthara', body, interventionType: 'checkin_nudge' },
  )
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

/**
 * Clinician → patient outreach, sent when a clinician flags a patient.
 *
 * Deliberately does NOT say "you have been flagged", name a risk level, or
 * imply a diagnosis. Two reasons: a lock-screen preview is visible to anyone
 * holding the phone, and telling someone they are "high risk" via push
 * notification is a clinical communication that belongs to a human being.
 *
 * What it does do is close the loop the other way — the patient learns their
 * clinician is paying attention, which is the single strongest anti-attrition
 * signal we can send.
 */
const sendClinicianOutreach = async (token, clinicianName = 'Your clinician') => {
  if (!token) return null

  const title = 'Niranthara'
  const body  = `${clinicianName} has been reviewing your progress. Open the app when you have a moment.`

  return sendByTokenType(
    token,
    {
      token,
      notification: { title, body },
      data: { screen: 'Home', type: 'clinician_outreach' },
      android: { priority: 'high', notification: { channelId: 'default' } },
    },
    { title, body, interventionType: 'checkin_nudge' },
  )
}

module.exports = {
  sendJITAINotification,
  sendClinicianCrisisAlert,
  sendCheckInReminder,
  sendClinicianOutreach,
  sendExpoPush,
  isExpoToken,
}
