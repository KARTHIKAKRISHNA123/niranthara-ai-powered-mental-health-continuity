// backend/scripts/seedDemoData.js
// Seeds the complete demo dataset: clinician + patient (with matching assignedClinician)
// Run: node scripts/seedDemoData.js

const { db, admin, auth } = require('../config/firebase')

// ── Fixed UIDs — consistent across all demo runs ─────────────────────────────
const CLINICIAN_UID = 'demo_clinician_meena_001'
const PATIENT_UID   = 'demo_patient_ananya_001'

// ── Clinician document ────────────────────────────────────────────────────────
const clinician = {
  uid:       CLINICIAN_UID,
  name:      'Dr. Meena Krishnan',
  email:     'meena.clinician@niranthara.dev',
  role:      'clinician',
  specialty: 'Psychiatry',
  hospital:  'Apollo Speciality Hospitals, Chennai',
  createdAt: new Date().toISOString(),
}

// ── Patient document ──────────────────────────────────────────────────────────
const patient = {
  uid:              PATIENT_UID,
  name:             'Ananya',
  email:            'ananya.demo@niranthara.dev',
  age:              25,
  language:         'en',
  personaType:      'women',
  conditions:       ['PMDD'],
  assignedClinician: CLINICIAN_UID,   // ← MUST match clinician UID exactly
  lastPeriodDate:   admin.firestore.Timestamp.fromDate(new Date('2026-04-18T08:00:00.000Z')),
  periodHistory: [
    admin.firestore.Timestamp.fromDate(new Date('2026-02-14T08:00:00.000Z')),
    admin.firestore.Timestamp.fromDate(new Date('2026-03-17T08:00:00.000Z')),
    admin.firestore.Timestamp.fromDate(new Date('2026-04-18T08:00:00.000Z')),
  ],
  avgCycleLength:   32.0,
  cycleVariance:    4.2,
  therapistContact: '080-46110007',
  emergencyContact: '+919876543210',
  permissions:      { steps: true, location: true, notifications: true },
  accessibilityMode: 'standard',
  baselineCalibrated: true,
  baselineData: {
    avgSteps:     6500,
    avgSleep:     7.2,
    avgGpsEntropy: 3,
    stdSteps:     800,
    stdSleep:     1.1,
    computedAt:   admin.firestore.Timestamp.fromDate(new Date('2026-04-05T00:00:00.000Z')),
  },
  riskLevel:       'high',
  riskScore:       0.72,
  profileComplete: true,
  role:            'user',
  createdAt:       admin.firestore.Timestamp.fromDate(new Date('2026-01-10T10:30:00.000Z')),
  updatedAt:       new Date().toISOString(),
}

// ── Pre-seeded mood log (shows history on patient detail page) ────────────────
const moodLog = {
  uid:          PATIENT_UID,
  moodScore:    2,
  energyLevel:  3,
  anxietyLevel: 7,
  sleepHours:   4.5,
  journalText:  '', // encrypted — left blank in seed
  journalLanguage: 'en',
  symptoms:     ['fatigue', 'low_mood'],
  nlpResults: {
    sentimentScore:     0.78,
    sentimentLabel:     'negative',
    emotionLabel:       'sadness',
    emotionConfidence:  0.82,
    crisisProbability:  0.61,
    detectedLanguage:   'en',
  },
  moodSentimentDivergence: 0.38,
  cycleDay:            14,
  cycleVulnerability:  0.71,
  riskScore:           0.72,
  riskLevel:           'high',
  topFactors: [
    'mood_score_avg_7d (−0.42)',
    'journal_sentiment_score (+0.38)',
    'cycle_vulnerability_score (+0.31)',
  ],
  offlineSyncId:     null,
  syncedToFirestore: true,
  createdAt:         new Date().toISOString(),
  date:              new Date().toISOString(),
}

// ── Pre-seeded alert (so Alerts page shows something immediately) ─────────────
const alert = {
  patientUid:     PATIENT_UID,
  patientName:    'Ananya',
  clinicianUid:   CLINICIAN_UID,
  type:           'high_risk',
  riskScore:      0.72,
  crisisProb:     0.61,
  emotionLabel:   'sadness',
  divergenceScore: 0.38,
  triggerFactors: [
    'mood_score_avg_7d (−0.42)',
    'journal_sentiment_score (+0.38)',
    'cycle_vulnerability_score (+0.31)',
  ],
  resolved:   false,
  resolvedAt: null,
  timestamp:  new Date().toISOString(),
}

// ── Seed function ─────────────────────────────────────────────────────────────
async function seedDemoData() {
  console.log('\n=== Niranthara Demo Data Seeder ===\n')

  try {
    // 1 — Clinician
    process.stdout.write('Seeding clinician... ')
    await db.collection('users').doc(CLINICIAN_UID).set(clinician)
    console.log(`OK  (UID: ${CLINICIAN_UID})`)

    // 2 — Patient (with assignedClinician pointing to above)
    process.stdout.write('Seeding patient...   ')
    await db.collection('users').doc(PATIENT_UID).set(patient)
    console.log(`OK  (UID: ${PATIENT_UID})`)

    // 3 — Mood log history
    process.stdout.write('Seeding mood log...  ')
    await db.collection('moodLogs').add(moodLog)
    console.log('OK')

    // 4 — Pre-seeded alert (so dashboard shows something before the live demo)
    process.stdout.write('Seeding alert...     ')
    await db.collection('clinicianAlerts').add(alert)
    console.log('OK')

    console.log('\n=== Seeding complete! ===')
    console.log('\nNext steps:')
    console.log('  1. Create a Firebase Auth account for the clinician:')
    console.log(`     Email: ${clinician.email}`)
    console.log(`     UID must be: ${CLINICIAN_UID}`)
    console.log('     → In Firebase Console: Authentication → Add User → then edit UID')
    console.log('\n  2. Create a Firebase Auth account for the patient:')
    console.log(`     Email: ${patient.email}`)
    console.log(`     UID must be: ${PATIENT_UID}`)
    console.log('\n  OR: Use the auto-generated Firebase Auth UIDs and update')
    console.log('      CLINICIAN_UID and PATIENT_UID at the top of this script.')
    console.log('\n  3. Open dashboard → login as clinician → Alerts tab should show 1 alert')
    console.log('  4. Log in on mobile as patient → Journal → write distress entry → Save')
    console.log('  5. Switch to dashboard → new alert appears in real-time\n')

    process.exit(0)
  } catch (err) {
    console.error('\nSeeding failed:', err.message)
    process.exit(1)
  }
}

seedDemoData()
