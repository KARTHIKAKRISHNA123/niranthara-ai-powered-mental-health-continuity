// src/utils/storage.js
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Offline Queue Keys
const OFFLINE_QUEUE_KEY = 'Niranthara_OFFLINE_QUEUE';

// Save securely (Auth tokens)
export const saveSecure = async (key, value) => {
  await SecureStore.setItemAsync(key, value);
};

export const getSecure = async (key) => {
  return await SecureStore.getItemAsync(key);
};

export const removeSecure = async (key) => {
  await SecureStore.deleteItemAsync(key);
};

// Offline Queue Management
export const addToOfflineQueue = async (collection, data) => {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = queueStr ? JSON.parse(queueStr) : [];
    
    queue.push({
      offlineSyncId: Date.now().toString() + Math.random().toString(36).substring(7),
      collection,
      data,
      timestamp: new Date().toISOString()
    });

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to add to offline queue', e);
  }
};

export const getOfflineQueue = async () => {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (e) {
    return [];
  }
};

export const clearOfflineQueue = async (syncedIds) => {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueStr) return;
    
    let queue = JSON.parse(queueStr);
    queue = queue.filter(item => !syncedIds.includes(item.offlineSyncId));
    
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to clear offline queue', e);
  }
};
