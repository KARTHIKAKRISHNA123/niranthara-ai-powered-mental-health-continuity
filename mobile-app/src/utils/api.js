// src/utils/api.js
import axios from 'axios';
import { getSecure, addToOfflineQueue } from './storage';
import NetInfo from '@react-native-community/netinfo';

// ── IMPORTANT: Change this IP to your machine's local IP when testing on a physical device.
// For Android Emulator:  http://10.0.2.2:5000/api
// For iOS Simulator:     http://localhost:5000/api
// For Physical Device:   http://<YOUR_WIFI_IP>:5000/api  (e.g. http://192.168.1.10:5000/api)
const BASE_URL = 'http://10.162.79.36:5000/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30s — Gemma 4B can take up to 5–10s to respond
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
