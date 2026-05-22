// backend/scripts/seedMoreDummyData.js
const { db, admin, auth } = require('../config/firebase');

async function seedMoreData(clinicianEmail) {
  console.log('\n=== Seeding More Dummy Patients & Alerts ===\n');

  try {
    let CLINICIAN_UID;
    try {
      const clinicianAuth = await auth.getUserByEmail(clinicianEmail);
      CLINICIAN_UID = clinicianAuth.uid;
      console.log(`Found clinician UID: ${CLINICIAN_UID}`);
    } catch (e) {
      console.error(`Could not find clinician with email ${clinicianEmail}`);
      process.exit(1);
    }

    const dummyPatients = [
      {
        uid: 'demo_patient_rahul_002',
        name: 'Rahul',
        email: 'rahul.demo@niranthara.dev',
        age: 28,
        language: 'en',
        personaType: 'men',
        assignedClinician: CLINICIAN_UID,
        riskLevel: 'moderate',
        riskScore: 0.45,
        profileComplete: true,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        uid: 'demo_patient_priya_003',
        name: 'Priya',
        email: 'priya.demo@niranthara.dev',
        age: 32,
        language: 'en',
        personaType: 'women',
        assignedClinician: CLINICIAN_UID,
        riskLevel: 'low',
        riskScore: 0.15,
        profileComplete: true,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        uid: 'demo_patient_karthik_004',
        name: 'Karthik',
        email: 'karthik.demo@niranthara.dev',
        age: 22,
        language: 'en',
        personaType: 'men',
        assignedClinician: CLINICIAN_UID,
        riskLevel: 'crisis',
        riskScore: 0.88,
        profileComplete: true,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    const dummyAlerts = [
      {
        patientUid: 'demo_patient_karthik_004',
        patientName: 'Karthik',
        clinicianUid: CLINICIAN_UID,
        type: 'high_risk',
        riskScore: 0.88,
        crisisProb: 0.75,
        emotionLabel: 'fear',
        divergenceScore: 0.52,
        triggerFactors: [
          'High crisis probability from journal',
          'Sleep deviation - critically low',
          'Social connectivity dropped 40%'
        ],
        resolved: false,
        resolvedAt: null,
        timestamp: new Date().toISOString(),
      },
      {
        patientUid: 'demo_patient_rahul_002',
        patientName: 'Rahul',
        clinicianUid: CLINICIAN_UID,
        type: 'loss_of_follow_up',
        riskScore: 0.45,
        crisisProb: 0.1,
        emotionLabel: 'neutral',
        divergenceScore: 0.2,
        triggerFactors: [
          'No check-ins for 4 days',
          'Elevated baseline risk score'
        ],
        resolved: false,
        resolvedAt: null,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      }
    ];

    for (const patient of dummyPatients) {
      await db.collection('users').doc(patient.uid).set(patient);
      console.log(`Seeded patient: ${patient.name}`);
    }

    for (const alert of dummyAlerts) {
      await db.collection('clinicianAlerts').add(alert);
      console.log(`Seeded alert for: ${alert.patientName}`);
    }

    console.log('\n=== Seeding Complete! ===');
    console.log('Refresh your dashboard to see the new patients and alerts.\n');
    process.exit(0);

  } catch (err) {
    console.error('\nSeeding failed:', err.message);
    process.exit(1);
  }
}

const clinicianEmail = process.argv[2];
if (!clinicianEmail) {
  console.error('Usage: node scripts/seedMoreDummyData.js <clinicianEmail>');
  process.exit(1);
}

seedMoreData(clinicianEmail);
