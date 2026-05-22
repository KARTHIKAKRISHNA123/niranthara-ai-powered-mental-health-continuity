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
    
    // We use .doc(uid).set() to force Firestore to use the exact UID from the JSON
    await db.collection('users').doc(testUser.uid).set(testUser);
    
    console.log(`✅ Successfully seeded user: ${testUser.name} with UID: ${testUser.uid}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding user data:", error);
    process.exit(1);
  }
}

seedData();