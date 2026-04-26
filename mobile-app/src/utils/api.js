// src/utils/api.js
import axios from 'axios';
import { getSecure, addToOfflineQueue } from './storage';
import NetInfo from '@react-native-community/netinfo';

// Set this to your local backend IP if testing on physical device, e.g. http://192.168.1.100:5000
const BASE_URL = 'http://192.168.70.1/api'; 

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

import { auth } from './firebase';

api.interceptors.request.use(async (config) => {
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Wrapper for offline-first architecture
export const postData = async (endpoint, data, collection) => {
  const state = await NetInfo.fetch();
  
  if (state.isConnected && state.isInternetReachable !== false) {
    try {
      const response = await api.post(endpoint, data);
      return { success: true, data: response.data };
    } catch (error) {
      console.warn(`API Error on ${endpoint}:`, error.message);
      // Fallback to offline queue if server is unreachable
      if (collection) {
        await addToOfflineQueue(collection, data);
        return { success: true, offline: true };
      }
      return { success: false, error: error.message };
    }
  } else {
    // Offline mode
    if (collection) {
      await addToOfflineQueue(collection, data);
      return { success: true, offline: true };
    }
    return { success: false, error: 'No internet connection' };
  }
};
