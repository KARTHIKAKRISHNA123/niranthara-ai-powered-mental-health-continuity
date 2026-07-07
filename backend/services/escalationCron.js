// services/escalationCron.js — Build_Guide §20 + §42
// Runs every 15 minutes (instead of daily) to catch crisis-probability spikes quickly.
// Triggers: (a) crisis_prob > 0.85 from recent mood log OR (b) high risk + 3+ days inactive.

const cron = require('node-cron');
const { db } = require('../config/firebase');
const { sendClinicianCrisisAlert } = require('./notificationService');

const CRISIS_PROB_THRESHOLD  = 0.85;
const HIGH_RISK_THRESHOLD    = 0.70;
const INACTIVITY_DAYS        = 3;
const RE_ESCALATE_HOURS      = 6; // Don't spam the same patient more than once per 6h

// ─── Core check ─────────────────────────────────────────────────────────────
async function checkEscalations() {
  console.log('[EscalationCron] Running — checking crisis prob + loss-of-follow-up…');
  const now  = new Date();
  let created = 0;

  try {
    const usersSnap = await db.collection('users').get();

    for (const doc of usersSnap.docs) {
      const user = doc.data();
      const uid  = doc.id;

      // Skip if recently escalated (avoid repeat alerts within 6h)
      if (user.lastEscalated) {
        const hoursSince = (now - new Date(user.lastEscalated)) / (1000 * 60 * 60);
        if (hoursSince < RE_ESCALATE_HOURS) continue;
      }

      // ── 1. Crisis probability spike (from latest mood log) ──────────────
      const latestLogSnap = await db.collection('moodLogs')
        .where('uid', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!latestLogSnap.empty) {
        const log = latestLogSnap.docs[0].data();
        if ((log.crisisProb || 0) >= CRISIS_PROB_THRESHOLD) {
          await _createAlert(uid, user, 'crisis_detected', 'critical',
            `Crisis language detected (NLP prob: ${(log.crisisProb * 100).toFixed(0)}%). Immediate clinician review required.`
          );
          created++;
          continue; // Don't also create a loss-of-follow-up alert for same user
        }
      }

      // ── 2. High risk + loss of follow-up ─────────────────────────────────
      const riskScore = user.riskScore || 0;
      if (riskScore < HIGH_RISK_THRESHOLD) continue;

      const passiveSnap = await db.collection('passiveLogs')
        .where('uid', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      const lastActive = passiveSnap.empty
        ? user.createdAt
        : passiveSnap.docs[0].data().createdAt;

      const daysSince = (now - new Date(lastActive)) / (1000 * 60 * 60 * 24);

      if (daysSince >= INACTIVITY_DAYS) {
        await _createAlert(uid, user, 'loss_of_contact', 'high',
          `High risk (${(riskScore * 100).toFixed(0)}%) and no app activity for ${Math.floor(daysSince)} days.`
        );
        created++;
      }
    }

    console.log(`[EscalationCron] Done — ${created} new alerts created.`);
  } catch (err) {
    console.error('[EscalationCron] Error:', err.message);
  }
}

// ─── Helper: create Firestore alert + FCM push ───────────────────────────────
async function _createAlert(uid, user, type, severity, message) {
  // 1. Firestore alert document — clinicianUid is REQUIRED: the dashboard and
  // /clinician/alerts both filter on it; without it the alert is invisible.
  await db.collection('clinicianAlerts').add({
    patientUid:     uid,
    patientName:    user.name || 'Unknown',
    clinicianUid:   user.assignedClinician || '',
    type,
    severity,
    message,
    triggerFactors: [message],
    riskScore:      user.riskScore || 0,
    crisisProb:     0,
    resolved:       false,
    resolvedAt:     null,
    timestamp:      new Date().toISOString(),
  });

  // 2. Mark user to prevent re-escalation spam
  await db.collection('users').doc(uid).update({
    lastEscalated: new Date().toISOString(),
  });

  // 3. FCM push — look up clinician FCM token from the users collection
  try {
    if (user.assignedClinician) {
      const clinicianDoc = await db.collection('users').doc(user.assignedClinician).get();
      const fcmToken     = clinicianDoc.exists ? clinicianDoc.data().fcmToken : null;
      if (fcmToken) {
        await sendClinicianCrisisAlert(fcmToken, user.name || 'A patient', user.riskScore || 0);
      }
    }
  } catch (fcmErr) {
    console.warn('[EscalationCron] FCM push failed (non-fatal):', fcmErr.message);
  }

  console.warn(`[EscalationCron] ALERT created — uid:${uid} type:${type} severity:${severity}`);
}

// ─── Start cron (called from index.js) ──────────────────────────────────────
function startEscalationCron() {
  // Every 15 minutes
  cron.schedule('*/15 * * * *', checkEscalations);
  console.log('[EscalationCron] Scheduled — runs every 15 minutes.');
  // Run immediately on startup too
  checkEscalations();
}

module.exports = { startEscalationCron, checkEscalations };
