// scripts/clearStaleAlerts.js
//
// Resolves the backlog of duplicate escalation alerts so the dashboard shows
// only what a clinician should actually act on.
//
// WHY THIS EXISTS: `escalationCron` re-fires `loss_of_contact` every 6 hours for
// any high-risk patient who has been inactive 3+ days. The seeded demo accounts
// (demo_patient_karthik_004, demo_patient_priya_003) have NO Firebase Auth
// record, so they can never become active — they re-alerted indefinitely and
// accumulated dozens of unresolved duplicates, burying the real crisis alerts.
//
// The cron now suppresses a duplicate while an unresolved alert of the same type
// is already open, so this backlog cannot rebuild. This script only cleans up
// what accumulated BEFORE that fix.
//
// Usage:
//   node scripts/clearStaleAlerts.js            # dry run — shows what it would do
//   node scripts/clearStaleAlerts.js --apply    # actually resolve
//   node scripts/clearStaleAlerts.js --apply --keep-crisis   # never touch crisis alerts
//
// Default behaviour keeps the NEWEST unresolved alert per (patient, type) and
// resolves the older duplicates. Crisis alerts are kept by default unless you
// pass --include-crisis, because silently closing a crisis alert is exactly the
// kind of thing this project must not do quietly.

require('dotenv').config();
const { db } = require('../config/firebase');

const APPLY          = process.argv.includes('--apply');
const INCLUDE_CRISIS = process.argv.includes('--include-crisis');

async function main() {
  console.log(APPLY ? 'MODE: APPLY (writes)' : 'MODE: DRY RUN (no writes) — pass --apply to commit');
  console.log('');

  const snap = await db.collection('clinicianAlerts').get();
  const open = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => !a.resolved);

  console.log(`Unresolved alerts found: ${open.length}`);
  if (open.length === 0) return;

  // Group by patient + type; newest first.
  const groups = new Map();
  for (const a of open) {
    const key = `${a.patientUid}::${a.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }

  let toResolve = [];
  for (const [key, list] of groups) {
    list.sort((x, y) => new Date(y.timestamp || 0) - new Date(x.timestamp || 0));
    const [newest, ...duplicates] = list;
    const isCrisis = newest.type === 'crisis_detected' || newest.severity === 'critical';

    if (isCrisis && !INCLUDE_CRISIS) {
      console.log(`  KEEP ALL  ${key} — ${list.length} crisis alert(s), untouched (use --include-crisis to override)`);
      continue;
    }
    if (duplicates.length === 0) {
      console.log(`  KEEP      ${key} — 1 alert, nothing to dedupe`);
      continue;
    }
    console.log(`  DEDUPE    ${key} — keeping newest (${newest.timestamp}), resolving ${duplicates.length} older`);
    toResolve = toResolve.concat(duplicates);
  }

  console.log('');
  console.log(`Would resolve: ${toResolve.length} duplicate alert(s)`);

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to write.');
    return;
  }

  // Firestore batches cap at 500 writes.
  const now = new Date().toISOString();
  for (let i = 0; i < toResolve.length; i += 450) {
    const batch = db.batch();
    for (const a of toResolve.slice(i, i + 450)) {
      batch.update(db.collection('clinicianAlerts').doc(a.id), {
        resolved:       true,
        resolvedAt:     now,
        resolvedBy:     'system:clearStaleAlerts',
        resolutionNote: 'Auto-resolved duplicate — superseded by a newer alert of the same type.',
      });
    }
    await batch.commit();
    console.log(`  committed ${Math.min(i + 450, toResolve.length)} / ${toResolve.length}`);
  }

  console.log('');
  console.log(`Done. Resolved ${toResolve.length} duplicate alert(s).`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('FAILED:', err.message); process.exit(1); });
