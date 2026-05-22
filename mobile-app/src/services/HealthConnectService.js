// src/services/HealthConnectService.js
// Health Connect integration for Android — per Build Guide §28
//
// Architecture:
//   Da Fit watch → Da Fit app → Health Connect (on-device DB) → This service → Backend → XGBoost
//
// IMPORTANT: Health Connect requires a Development Build (EAS), NOT Expo Go.
// In Expo Go, this service automatically returns simulated data so the full
// backend pipeline can still be demonstrated.

import { Platform } from 'react-native';
import { api } from '../utils/api';

// ── Try to import Health Connect (only works in dev build, not Expo Go) ───────
let HC = null;
try {
  HC = require('react-native-health-connect');
} catch (_) {
  // Not available in Expo Go — will use simulation mode
}

const IS_ANDROID    = Platform.OS === 'android';
const HC_AVAILABLE  = IS_ANDROID && HC !== null;

// ── Permission types needed for the XGBoost 15-feature model ─────────────────
const REQUIRED_PERMISSIONS = [
  { accessType: 'read', recordType: 'HeartRate'      },
  { accessType: 'read', recordType: 'Steps'          },
  { accessType: 'read', recordType: 'SleepSession'   },
  { accessType: 'read', recordType: 'RestingHeartRate'},
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
];

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// Call once on app startup. Returns { available: bool, initialized: bool }
// ─────────────────────────────────────────────────────────────────────────────
export async function initHealthConnect() {
  if (!HC_AVAILABLE) {
    console.log('[HealthConnect] Running in simulation mode (Expo Go / iOS)');
    return { available: false, initialized: false, reason: 'simulation_mode' };
  }
  try {
    const result = await HC.initialize();
    console.log('[HealthConnect] Initialized:', result);
    return { available: true, initialized: result };
  } catch (e) {
    console.warn('[HealthConnect] Init failed:', e.message);
    return { available: false, initialized: false, reason: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST PERMISSIONS
// Triggers the system permission popup. Returns granted permission list.
// ─────────────────────────────────────────────────────────────────────────────
export async function requestHealthPermissions() {
  if (!HC_AVAILABLE) return { granted: false, simulation: true };
  try {
    const granted = await HC.requestPermission(REQUIRED_PERMISSIONS);
    console.log('[HealthConnect] Permissions granted:', granted);
    return { granted: granted.length > 0, permissions: granted };
  } catch (e) {
    console.warn('[HealthConnect] Permission request failed:', e.message);
    return { granted: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH BIOMETRICS  (last 24 hours)
// Returns a normalized payload ready to POST to the backend.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchBiometrics() {
  const endTime   = new Date();
  const startTime = new Date(endTime - 24 * 60 * 60 * 1000); // 24h ago
  const timeRange = {
    operator:  'between',
    startTime: startTime.toISOString(),
    endTime:   endTime.toISOString(),
  };

  if (!HC_AVAILABLE) {
    // ── Simulation mode: realistic-looking data for Expo Go demos ────────────
    return _simulatedBiometrics();
  }

  try {
    const [hrRecords, stepsRecords, sleepRecords, restingHrRecords, hrvRecords] =
      await Promise.allSettled([
        HC.readRecords('HeartRate',      { timeRangeFilter: timeRange }),
        HC.readRecords('Steps',          { timeRangeFilter: timeRange }),
        HC.readRecords('SleepSession',   { timeRangeFilter: timeRange }),
        HC.readRecords('RestingHeartRate', { timeRangeFilter: timeRange }),
        HC.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter: timeRange }),
      ]);

    // ── Heart rate average ────────────────────────────────────────────────────
    const hrSamples = hrRecords.status === 'fulfilled'
      ? hrRecords.value?.records?.flatMap(r => r.samples?.map(s => s.beatsPerMinute) || []) || []
      : [];
    const avgHr = hrSamples.length
      ? hrSamples.reduce((s, v) => s + v, 0) / hrSamples.length
      : 72;

    // ── Total steps ───────────────────────────────────────────────────────────
    const stepRecordList = stepsRecords.status === 'fulfilled'
      ? stepsRecords.value?.records || []
      : [];
    const totalSteps = stepRecordList.reduce((s, r) => s + (r.count || 0), 0);

    // ── Sleep duration ────────────────────────────────────────────────────────
    const sleepList = sleepRecords.status === 'fulfilled'
      ? sleepRecords.value?.records || []
      : [];
    const sleepHours = sleepList.reduce((sum, r) => {
      const dur = (new Date(r.endTime) - new Date(r.startTime)) / (1000 * 60 * 60);
      return sum + dur;
    }, 0);

    // ── Resting HR ────────────────────────────────────────────────────────────
    const restingHrList = restingHrRecords.status === 'fulfilled'
      ? restingHrRecords.value?.records || []
      : [];
    const restingHr = restingHrList.length
      ? restingHrList[restingHrList.length - 1]?.beatsPerMinute || avgHr
      : avgHr;

    // ── HRV (RMSSD) ───────────────────────────────────────────────────────────
    const hrvList = hrvRecords.status === 'fulfilled'
      ? hrvRecords.value?.records || []
      : [];
    const latestHrv = hrvList.length
      ? hrvList[hrvList.length - 1]?.heartRateVariabilityMillis || null
      : null;

    return {
      source:       'health_connect',
      fetchedAt:    endTime.toISOString(),
      heartRate:    Math.round(avgHr),
      restingHeartRate: Math.round(restingHr),
      hrv:          latestHrv ? Math.round(latestHrv) : null,
      steps:        totalSteps,
      sleepHours:   Math.round(sleepHours * 10) / 10,
      windowHours:  24,
    };
  } catch (e) {
    console.warn('[HealthConnect] Fetch failed, using simulation:', e.message);
    return _simulatedBiometrics();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC TO BACKEND
// Fetches biometrics and POSTs them to /api/passive/biometric-sync
// Returns the backend response (includes updated risk score).
// ─────────────────────────────────────────────────────────────────────────────
export async function syncBiometricsToBackend() {
  try {
    const biometrics = await fetchBiometrics();
    const response   = await api.post('/passive/biometric-sync', biometrics);
    console.log('[HealthConnect] Synced to backend:', response.data);
    return { success: true, data: response.data, biometrics };
  } catch (e) {
    console.warn('[HealthConnect] Backend sync failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION MODE  (used in Expo Go / iOS for demo)
// ─────────────────────────────────────────────────────────────────────────────
function _simulatedBiometrics() {
  // Slightly randomised each call to look realistic in demos
  const jitter = (base, pct) => Math.round(base * (1 + (Math.random() - 0.5) * pct));
  return {
    source:           'simulation',
    fetchedAt:        new Date().toISOString(),
    heartRate:        jitter(88, 0.15),          // Slightly elevated — stress signal
    restingHeartRate: jitter(72, 0.10),
    hrv:              jitter(38, 0.20),           // Lower HRV = higher stress
    steps:            jitter(4200, 0.30),         // Below baseline (6500) — reduced activity
    sleepHours:       Math.round((5 + Math.random() * 1.5) * 10) / 10, // 5–6.5h
    windowHours:      24,
    note:             'Simulated data — Health Connect unavailable in Expo Go',
  };
}
