// src/services/syncService.js
import NetInfo from '@react-native-community/netinfo';
import { api } from '../utils/api';
import { getOfflineQueue, clearOfflineQueue } from '../utils/storage';

export const processOfflineSync = async () => {
  const state = await NetInfo.fetch();
  if (!state.isConnected || state.isInternetReachable === false) {
    return false;
  }

  const queue = await getOfflineQueue();
  if (queue.length === 0) return true;

  try {
    // We'll send batches of up to 50 items
    const batch = queue.slice(0, 50);
    const response = await api.post('/passive/sync-batch', { items: batch });
    
    if (response.data && response.data.results) {
      const syncedIds = response.data.results
        .filter(r => r.status === 'synced' || r.status === 'duplicate_skipped')
        .map(r => r.offlineSyncId);
        
      await clearOfflineQueue(syncedIds);
    }
    return true;
  } catch (error) {
    console.error('Offline sync failed', error);
    return false;
  }
};
