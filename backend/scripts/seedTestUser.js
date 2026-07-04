// backend/scripts/seedTestUser.js

// Import your existing Firebase Admin configuration
const { db, admin } = require('../config/firebase'); 

const testUser = {
  "uid": "u8vX9yZ2aB4cD1eF6gH7jK5mN",
  "name": "Ananya",
  "age": 25,
  "language": "ta",
  "personaType": "women",
  "conditions": ["PMDD"],
  // Converting strings to Firestore Timestamps
  "lastPeriodDate": admin.firestore.Timestamp.fromDate(new Date("2026-04-18T08:00:00.000Z")),
  "periodHistory": [
    admin.firestore.Timestamp.fromDate(new Date("2026-02-14T08:00:00.000Z")),
    admin.firestore.Timestamp.fromDate(new Date("2026-03-17T08:00:00.000Z")),
    admin.firestore.Timestamp.fromDate(new Date("2026-04-18T08:00:00.000Z"))
  ],
  "avgCycleLength": 32.0,
  "cycleVariance": 4.2,
  "therapistContact": "080-46110007",
  "emergencyContact": "+919876543210",
  "assignedClinician": "clinician_meena_778899", // Make sure this matches your clinician!
  "permissions": {
    "steps": true,
    "location": true,
    "notifications": true
  },
  "accessibilityMode": "standard",
  "baselineCalibrated": true,
  "baselineData": {
    "avgSteps": 6500,
    "avgSleep": 7.2,
    "avgGpsEntropy": 3,
    "stdSteps": 800,
    "stdSleep": 1.1,
    "computedAt": admin.firestore.Timestamp.fromDate(new Date("2026-04-05T00:00:00.000Z"))
  },
  "riskLevel": "high",
  "riskScore": 0.72,
  "profileComplete": true,
  "role": "user",
  "createdAt": admin.firestore.Timestamp.fromDate(new Date("2026-01-10T10:30:00.000Z")),
  "updatedAt": admin.firestore.Timestamp.fromDate(new Date("2026-04-22T14:45:00.000Z"))
};

async function seedData() {
  try {
    console.log("Connecting to Firestore...");
    
    // 1. Find the real Clinician UID
    const clinSnap = await db.collection('users').where('role', '==', 'clinician').get();
    if (!clinSnap.empty) {
      testUser.assignedClinician = clinSnap.docs[0].id;
      console.log(`👨‍⚕️ Found Clinician: ${testUser.assignedClinician}`);
    }

    // 2. Find the real Mobile User
    const usersSnap = await db.collection('users').where('role', '==', 'user').get();
    let realUserDoc = null;
    let latestTime = 0;
    
    usersSnap.forEach(doc => {
      // Ignore the hardcoded dummy IDs
      if (!doc.id.includes('demo_') && !doc.id.includes('u8vX9')) {
        const t = doc.data().createdAt;
        const timeMs = t && t.toDate ? t.toDate().getTime() : (new Date(t)).getTime();
        if (timeMs > latestTime) {
          latestTime = timeMs;
          realUserDoc = doc;
        }
      }
    });

    if (realUserDoc) {
      testUser.uid = realUserDoc.id;
      if (realUserDoc.data().name) testUser.name = realUserDoc.data().name;
      console.log(`🔗 Found real mobile user: ${testUser.name} (${testUser.uid})`);
    } else {
      console.log("⚠️ Using default dummy UID.");
    }

    // We use .doc(uid).set() to force Firestore to use the exact UID
    await db.collection('users').doc(testUser.uid).set(testUser, { merge: true });
    
    // Seed mock Clinician Alerts
    const alert1 = {
      patientUid: testUser.uid,
      patientName: testUser.name,
      clinicianUid: testUser.assignedClinician,
      type: 'high_risk',
      riskScore: 0.88,
      crisisProb: 0.85,
      triggerFactors: [
        'Crisis probability elevated above 0.85 (mental-roberta)',
        'Mood-sentiment divergence detected (suppression)',
        'Physiological stress score: 72% (HRV dropped)'
      ],
      source: 'jitai_cron',
      resolved: false,
      resolvedAt: null,
      timestamp: new Date().toISOString()
    };

    const alert2 = {
      patientUid: testUser.uid,
      patientName: testUser.name,
      clinicianUid: testUser.assignedClinician,
      type: 'silent_deviation',
      riskScore: 0.65,
      crisisProb: 0.1,
      triggerFactors: [
        'No check-ins for 72 hours',
        'GPS entropy dropped by 45%',
        'Previous check-in indicated moderate depression'
      ],
      source: 'escalation_cron',
      resolved: false,
      resolvedAt: null,
      timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    };

    await db.collection('clinicianAlerts').add(alert1);
    await db.collection('clinicianAlerts').add(alert2);
    console.log(`✅ Successfully seeded 2 clinician alerts for the dashboard`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

seedData();