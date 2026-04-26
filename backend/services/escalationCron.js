// services/escalationCron.js
const { db } = require('../config/firebase');

/**
 * Runs daily to detect "Loss of Follow-up" cases (high ML risk + no engagement).
 */
async function checkEscalations() {
  console.log('[EscalationCron] Starting daily check for loss of follow-up...');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const now = new Date();
    
    let escalatedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      
      // Skip if already escalated recently
      if (user.lastEscalated && (now - new Date(user.lastEscalated)) < (7 * 24 * 60 * 60 * 1000)) {
        continue; 
      }

      const riskScore = user.riskScore || 0;
      
      // Check passive logs to see last engagement
      const logsSnap = await db.collection('passiveLogs')
        .where('uid', '==', doc.id)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      let lastActive = user.createdAt; // Fallback
      if (!logsSnap.empty) {
        lastActive = logsSnap.docs[0].data().createdAt;
      }
      
      const daysSinceActive = (now - new Date(lastActive)) / (1000 * 60 * 60 * 24);

      // Rule: If XGBoost Risk > 0.7 AND Last App Open > 3 Days
      if (riskScore > 0.7 && daysSinceActive > 3) {
        console.warn(`[EscalationCron] User ${doc.id} escalated. Risk: ${riskScore}, Inactive: ${daysSinceActive} days.`);
        
        // 1. Create a Critical Alert in Firestore for the Clinician Dashboard
        await db.collection('clinicianAlerts').add({
          patientUid: doc.id,
          patientName: user.name || 'Unknown',
          type: 'loss_of_contact',
          severity: 'critical',
          message: `Patient has high ML risk score (${(riskScore*100).toFixed(0)}%) and has not opened the app in ${Math.floor(daysSinceActive)} days.`,
          resolved: false,
          timestamp: now.toISOString()
        });

        // 2. Mark user document
        await db.collection('users').doc(doc.id).update({
          lastEscalated: now.toISOString()
        });

        // 3. (Mock) Trigger SMS to Emergency Contact
        // In production: await twilio.messages.create({ to: user.emergencyContact, ... })

        escalatedCount++;
      }
    }
    
    console.log(`[EscalationCron] Completed. Escalated ${escalatedCount} high-risk inactive patients.`);
  } catch (error) {
    console.error('[EscalationCron] Error running escalation checks:', error);
  }
}

module.exports = { checkEscalations };
