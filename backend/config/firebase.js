const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('../serviceAccountKey.json'))
  })
}

const db   = admin.firestore()
const fcm  = admin.messaging()
const auth = admin.auth()

module.exports = { admin, db, fcm, auth }