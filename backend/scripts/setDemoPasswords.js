// scripts/setDemoPasswords.js
//
// Sets a known password on the demo accounts so the phone and dashboard can be
// logged into during a demo.
//
// WHY THIS EXISTS: Firebase Auth stores password HASHES. Once a demo account's
// password is forgotten it cannot be read back by anyone, including the project
// owner — it can only be reset. This script resets the known demo accounts to a
// documented password via the Admin SDK.
//
// It ONLY touches the accounts listed in ACCOUNTS below. It will never modify an
// account that is not in that list, so a real self-registered user cannot be
// caught by a typo.
//
// Usage:
//   node scripts/setDemoPasswords.js              # dry run — lists targets
//   node scripts/setDemoPasswords.js --apply      # actually set passwords
//
// AFTER THE HACKATHON: these are shared demo credentials in a project holding
// mental-health data. Rotate or delete these accounts.

require('dotenv').config();
const { auth, db } = require('../config/firebase');

const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) { console.error('Set DEMO_PASSWORD first'); process.exit(1); }

// Explicit allow-list. Nothing outside this array is ever touched.
const ACCOUNTS = [
  { email: 'meena.clinician@niranthara.dev', use: 'DASHBOARD — Dr. Meena Krishnan' },
  { email: 'ananya.demo@niranthara.dev',     use: 'PHONE — Ananya, the richest demo patient' },
  { email: 'priya123@gmail.com',             use: 'PHONE (spare) — Priya Sharma' },
];

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? 'MODE: APPLY (will set passwords)' : 'MODE: DRY RUN — pass --apply to commit');
  console.log(`Password to set: ${PASSWORD}`);
  console.log('');

  for (const acct of ACCOUNTS) {
    let user;
    try {
      user = await auth.getUserByEmail(acct.email);
    } catch {
      console.log(`  SKIP    ${acct.email} — no Firebase Auth account exists`);
      continue;
    }

    // A clinician with no Firestore doc logs in to an empty dashboard, which
    // looks like a broken product. Warn loudly rather than let it surprise you
    // on stage.
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      console.log(`  WARN    ${acct.email} — auth exists but NO Firestore user doc; login will look broken`);
    }

    if (!APPLY) {
      console.log(`  WOULD   ${acct.email.padEnd(36)} ${acct.use}`);
      continue;
    }

    await auth.updateUser(user.uid, { password: PASSWORD });
    console.log(`  SET     ${acct.email.padEnd(36)} ${acct.use}`);
  }

  console.log('');
  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to set the passwords.');
    return;
  }
  console.log('Done. Log in with the password above.');
  console.log('Reminder: rotate or delete these shared accounts after the hackathon.');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('FAILED:', err.message); process.exit(1); });
