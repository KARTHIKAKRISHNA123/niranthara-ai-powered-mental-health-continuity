// smartwatch/config/firebase.js
// Reuses the same serviceAccountKey.json as backend — no separate credentials needed

const admin = require('firebase-admin')
const path  = require('path')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require(path.join(__dirname, '../../backend/serviceAccountKey.json'))
    )
  })
  console.log(`[BiometricSync] init: Firebase Admin initialized at ${new Date().toISOString()}`)
}

const db  = admin.firestore()
const fcm = admin.messaging()

module.exports = { admin, db, fcm }
