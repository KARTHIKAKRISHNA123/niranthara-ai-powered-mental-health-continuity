// services/syncService.js — Process offline sync queue from mobile

const { db } = require('../config/firebase')

/**
 * Process a batch of offline-queued items from mobile.
 * Deduplicates by offlineSyncId. Supports moodLogs, passiveLogs, chatLogs.
 */
const processBatch = async (uid, items) => {
  const results = []
  const ALLOWED_COLLECTIONS = ['moodLogs', 'passiveLogs', 'chatLogs', 'jitaiLogs']

  for (const item of (items || []).slice(0, 100)) {
    const { collection, data, offlineSyncId } = item
    if (!ALLOWED_COLLECTIONS.includes(collection)) {
      results.push({ offlineSyncId, status: 'rejected', reason: 'unknown collection' })
      continue
    }

    try {
      // Dedup check
      if (offlineSyncId) {
        const dup = await db.collection(collection).where('offlineSyncId', '==', offlineSyncId).limit(1).get()
        if (!dup.empty) {
          results.push({ offlineSyncId, status: 'duplicate_skipped' })
          continue
        }
      }

      const ref = await db.collection(collection).add({
        ...data,
        uid,
        offlineSyncId: offlineSyncId || null,
        syncedToFirestore: true,
        syncedAt: new Date().toISOString()
      })

      results.push({ id: ref.id, offlineSyncId, collection, status: 'synced' })
    } catch (e) {
      results.push({ offlineSyncId, collection, status: 'error', error: e.message })
    }
  }

  return results
}

module.exports = { processBatch }
