// src/services/GoogleHealthService.js
// Cloud wearable path — talks to the backend, which talks to Google Health.
//
// Why this exists next to HealthConnectService:
//   HealthConnectService reads Android's on-device Health Connect. It is a
//   native module, so in Expo Go it always falls back to simulated numbers —
//   a real Fitbit Charge 6 cannot reach the pipeline that way.
//   This path needs no native module: the user completes a Google consent in
//   the system browser once, and from then on the BACKEND pulls the data. It
//   works in Expo Go, on iOS, and even while the phone is asleep.

import { Linking } from 'react-native';
import { api } from '../utils/api';

export async function getStatus() {
  try {
    const { data } = await api.get('/google-health/status');
    return data; // { configured, connected, scopes }
  } catch (e) {
    return { configured: false, connected: false, error: e.message };
  }
}

/**
 * Opens the Google consent screen in the system browser.
 * Returns { started: true } once the browser is handed the URL — the backend
 * receives the callback, so there is nothing to await in the app.
 */
export async function connect() {
  try {
    const { data } = await api.get('/google-health/connect');
    if (!data?.consentUrl) return { started: false, error: 'No consent URL returned' };
    const canOpen = await Linking.canOpenURL(data.consentUrl);
    if (!canOpen) return { started: false, error: 'No browser available to open the Google consent page' };
    await Linking.openURL(data.consentUrl);
    return { started: true };
  } catch (e) {
    return {
      started: false,
      error: e.response?.data?.hint || e.response?.data?.error || e.message,
    };
  }
}

/** Pull the last 24h from Google Health and run it through the risk pipeline. */
export async function sync(windowHours = 24) {
  try {
    const { data } = await api.post('/google-health/sync', { windowHours }, { timeout: 45000 });
    return { success: true, ...data };
  } catch (e) {
    if (e.response?.status === 409) {
      return { success: false, needsConnect: true, error: 'Google Health is not connected yet.' };
    }
    return { success: false, error: e.response?.data?.error || e.message };
  }
}

export async function disconnect() {
  try {
    await api.delete('/google-health/disconnect');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
