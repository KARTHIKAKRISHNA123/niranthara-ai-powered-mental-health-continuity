// backend/scripts/seedClinician.js
const { auth, db } = require('../config/firebase');

async function seedClinician() {
  const email = 'clinician@niranthara.ai';
  const password = 'Niranthara@2026';
  const name = 'Dr. Priya Sundaram';

  try {
    console.log('Creating clinician user in Firebase Auth...');
    // Create the user in Firebase Auth
    let user;
    try {
      user = await auth.createUser({
        email: email,
        password: password,
        displayName: name,
      });
      console.log(`Successfully created user: ${user.uid}`);
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        console.log('Clinician user already exists in Firebase Auth, retrieving UID...');
        user = await auth.getUserByEmail(email);
      } else {
        throw authError;
      }
    }

    console.log('Seeding clinician document in Firestore...');
    // Add the user to the "users" collection with role "clinician"
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      name: name,
      email: email,
      role: 'clinician',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Also add to a specific 'clinicians' collection if dashboard uses it
    await db.collection('clinicians').doc(user.uid).set({
      uid: user.uid,
      name: name,
      email: email,
      role: 'clinician',
      createdAt: new Date().toISOString()
    }, { merge: true });

    console.log('Clinician successfully seeded!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding clinician:', error);
    process.exit(1);
  }
}

seedClinician();
