// backend/scripts/linkAuthToFirestore.js
// Run AFTER creating Firebase Auth accounts for demo users.
// This script reads the real Auth UIDs and updates the Firestore documents
// to match, ensuring dashboard queries work correctly.
//
// Usage:
//   node scripts/linkAuthToFirestore.js <clinicianEmail> <patientEmail>
//
// Example:
//   node scripts/linkAuthToFirestore.js meena.clinician@niranthara.dev ananya.demo@niranthara.dev

const { db, admin, auth } = require('../config/firebase')

const OLD_CLINICIAN_UID = 'demo_clinician_meena_001'
const OLD_PATIENT_UID   = 'demo_patient_ananya_001'

async function linkAuthToFirestore(clinicianEmail, patientEmail) {
  console.log('\n=== Linking Firebase Auth UIDs to Firestore ===\n')

  try {
    // Look up real Firebase Auth UIDs by email
    console.log(`Looking up Auth UID for clinician (${clinicianEmail})...`)
    const clinicianAuth = await auth.getUserByEmail(clinicianEmail)
    const CLINICIAN_UID = clinicianAuth.uid
    console.log(`  Found: ${CLINICIAN_UID}`)

    console.log(`Looking up Auth UID for patient (${patientEmail})...`)
    const patientAuth   = await auth.getUserByEmail(patientEmail)
    const PATIENT_UID   = patientAuth.uid
    console.log(`  Found: ${PATIENT_UID}`)

    // Update clinician Firestore doc with real UID
    process.stdout.write('\nMoving clinician doc to real UID... ')
    const oldClinician = await db.collection('users').doc(OLD_CLINICIAN_UID).get()
    if (oldClinician.exists) {
      await db.collection('users').doc(CLINICIAN_UID).set({
        ...oldClinician.data(),
        uid:   CLINICIAN_UID,
        email: clinicianEmail,
      })
      await db.collection('users').doc(OLD_CLINICIAN_UID).delete()
      console.log('OK')
    } else {
      // Doc already at real UID — just update uid field
      await db.collection('users').doc(CLINICIAN_UID).set({
        uid:       CLINICIAN_UID,
        name:      'Dr. Meena Krishnan',
        email:     clinicianEmail,
        role:      'clinician',
        specialty: 'Psychiatry',
        hospital:  'Apollo Speciality Hospitals, Chennai',
        createdAt: new Date().toISOString(),
      }, { merge: true })
      console.log('OK (created fresh)')
    }

    // Update patient Firestore doc with real UID + correct assignedClinician
    process.stdout.write('Moving patient doc to real UID...   ')
    const oldPatient = await db.collection('users').doc(OLD_PATIENT_UID).get()
    if (oldPatient.exists) {
      await db.collection('users').doc(PATIENT_UID).set({
        ...oldPatient.data(),
        uid:               PATIENT_UID,
        email:             patientEmail,
        assignedClinician: CLINICIAN_UID,  // Real UID
      })
      await db.collection('users').doc(OLD_PATIENT_UID).delete()
      console.log('OK')
    } else {
      await db.collection('users').doc(PATIENT_UID).set({
        uid:               PATIENT_UID,
        name:              'Ananya',
        email:             patientEmail,
        role:              'user',
        assignedClinician: CLINICIAN_UID,
        riskLevel:         'high',
        riskScore:         0.72,
        createdAt:         new Date().toISOString(),
      }, { merge: true })
      console.log('OK (created fresh)')
    }

    // Update the pre-seeded alert to use real UIDs
    process.stdout.write('Updating pre-seeded alert UIDs...   ')
    const alertSnap = await db.collection('clinicianAlerts')
      .where('clinicianUid', '==', OLD_CLINICIAN_UID).get()
    const batch = db.batch()
    alertSnap.docs.forEach(d => batch.update(d.ref, {
      patientUid:   PATIENT_UID,
      clinicianUid: CLINICIAN_UID,
    }))
    await batch.commit()
    console.log('OK')

    // Update mood logs to use real patient UID
    process.stdout.write('Updating mood log UIDs...           ')
    const moodSnap = await db.collection('moodLogs')
      .where('uid', '==', OLD_PATIENT_UID).get()
    const batch2 = db.batch()
    moodSnap.docs.forEach(d => batch2.update(d.ref, { uid: PATIENT_UID }))
    await batch2.commit()
    console.log('OK')

    console.log('\n=== Linking complete! ===')
    console.log(`\n  Clinician UID: ${CLINICIAN_UID}`)
    console.log(`  Patient UID:   ${PATIENT_UID}`)
    console.log('\n  Dashboard login: ' + clinicianEmail)
    console.log('  Mobile login:   ' + patientEmail)
    console.log('\n  The dashboard should now show Ananya under the patient list.')
    console.log('  The Alerts tab should show 1 pre-seeded high_risk alert.\n')

    process.exit(0)
  } catch (err) {
    console.error('\nLinking failed:', err.message)
    if (err.code === 'auth/user-not-found') {
      console.error('\nThe email was not found in Firebase Auth.')
      console.error('Create the accounts first in Firebase Console → Authentication → Add User')
    }
    process.exit(1)
  }
}

const [,, clinicianEmail, patientEmail] = process.argv
if (!clinicianEmail || !patientEmail) {
  console.error('Usage: node scripts/linkAuthToFirestore.js <clinicianEmail> <patientEmail>')
  process.exit(1)
}
linkAuthToFirestore(clinicianEmail, patientEmail)
