// src/utils/api.js
import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSecure, addToOfflineQueue } from './storage';
import NetInfo from '@react-native-community/netinfo';

// ── Backend host resolution ───────────────────────────────────────────────────
// The backend runs on the SAME machine as the Expo dev server, so we derive its
// LAN IP from the packager host instead of hardcoding it. Hand-editing this
// constant on every network change is what silently broke chat, check-ins and
// cycle: a one-digit typo (.49 vs .36) made every request fail, and postData()
// then reported those failures as "saved offline".
//
// Override order:
//   1. EXPO_PUBLIC_API_URL (set in .env or the shell) — full base URL wins
//   2. Expo packager host   — automatic on Expo Go / dev client over LAN
//   3. Platform default     — 10.0.2.2 on Android emulator, localhost otherwise
const PORT = 5000;

function packagerHost() {
  // hostUri looks like "10.154.166.36:8081" when served over LAN.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  // Tunnel/production builds give a domain, not a LAN IP — not usable here.
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : null;
}

function resolveBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const host = packagerHost();
  if (host) return `http://${host}:${PORT}/api`;

  return Platform.OS === 'android'
    ? `http://10.0.2.2:${PORT}/api`   // Android emulator loopback
    : `http://localhost:${PORT}/api`;
}

export const BASE_URL = resolveBaseUrl();
console.log('[api] backend base URL →', BASE_URL);

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000, // default for light reads; heavy routes override per-request
});

// Per-route timeouts. The mood-log path runs encryption + 3 NLP calls + LSTM +
// XGBoost server-side, which routinely exceeds the 8s default; when it timed
// out the entry was queued offline and the user was told it had been saved.
export const TIMEOUTS = {
  moodLog: 45000,
  chat:    60000,
  cycle:   20000,
};

import { auth } from './firebase';

api.interceptors.request.use(async (config) => {
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A queued write is only honest when the device is genuinely offline or the
// server never answered. If the server DID answer and rejected the request,
// queueing hides a real bug and replays a request that will fail again.
const isTransport = (error) =>
  !error.response &&
  (error.code === 'ECONNABORTED' ||
   error.code === 'ERR_NETWORK'   ||
   error.message === 'Network Error');

/**
 * Offline-first POST.
 * Resolves to one of:
 *   { success: true,  data }              — server accepted
 *   { success: true,  offline: true }     — genuinely queued for later sync
 *   { success: false, error, status }     — server rejected; NOT queued
 */
export const postData = async (endpoint, data, collection, config = {}) => {
  const state = await NetInfo.fetch();
  const online = state.isConnected && state.isInternetReachable !== false;

  if (!online) {
    if (collection) {
      await addToOfflineQueue(collection, data);
      return { success: true, offline: true };
    }
    return { success: false, error: 'No internet connection' };
  }

  try {
    const response = await api.post(endpoint, data, config);
    return { success: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    console.warn(`API Error on ${endpoint}:`, status || error.code, error.message);

    // Server answered with an error — surface it instead of pretending success.
    if (!isTransport(error)) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        status,
      };
    }

    // Server unreachable / timed out — queueing is legitimate here.
    if (collection) {
      await addToOfflineQueue(collection, data);
      return { success: true, offline: true };
    }
    return { success: false, error: error.message };
  }
};
