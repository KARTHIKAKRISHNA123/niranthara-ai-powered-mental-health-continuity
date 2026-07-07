// src/services/HealthConnectService.js
// Health Connect integration for Android.
//
// Data flow:
//   Smartwatch / phone sensors → Google Fit / Samsung Health / vendor app
//   → Android Health Connect (on-device DB) → THIS service
//   → POST /api/passive/biometric-sync → XGBoost risk → clinician dashboard
//
// Source priority:
//   REAL_HEALTH_DATA (default) → use Health Connect whenever real records exist.
//   Fall back to SIMULATED_DATA only when:
//     • Health Connect is unavailable (Expo Go / iOS / no module)
//     • required permissions are not granted
//     • no biometric records exist in the time window
//   SIMULATED mode can also be forced (hidden demo/testing mode).
//
// IMPORTANT: Health Connect is a native module — it requires a custom
// development build, NOT Expo Go. In Expo Go this file returns simulated data
// so the full backend pipeline still demos end-to-end.

import { Platform } from 'react-native';
import { api } from '../utils/api';

// ── Try to import Health Connect (only resolves in a dev build) ───────────────
let HC = null;
try {
  HC = require('react-native-health-connect');
} catch (_) {
  // Not available in Expo Go — simulation mode will be used.
}

const IS_ANDROID   = Platform.OS === 'android';
const HC_AVAILABLE = IS_ANDROID && HC !== null;

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE MODE FLAG  (the configuration switch you asked for)
//   REAL      → prefer Health Connect, fall back to simulation per rules above
//   SIMULATED → always simulate (hidden demo/testing mode)
// Default is REAL so real data is used whenever it exists.
// ─────────────────────────────────────────────────────────────────────────────
export const BIOMETRIC_SOURCE = { REAL: 'real', SIMULATED: 'simulated' };
let _biometricMode = BIOMETRIC_SOURCE.REAL;

export function toggleBiometricMode() {
  _biometricMode = _biometricMode === BIOMETRIC_SOURCE.REAL
    ? BIOMETRIC_SOURCE.SIMULATED : BIOMETRIC_SOURCE.REAL;
  console.log('[HealthConnect] Biometric mode →', _biometricMode);
  return _biometricMode;
}

// ── Permissions: core 5 (XGBoost features) + optional calories/distance ──────
const REQUIRED_PERMISSIONS = [
  { accessType: 'read', recordType: 'HeartRate'                  },
  { accessType: 'read', recordType: 'Steps'                      },
  { accessType: 'read', recordType: 'SleepSession'               },
  { accessType: 'read', recordType: 'RestingHeartRate'           },
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd'  },
  { accessType: 'read', recordType: 'TotalCaloriesBurned'        }, // optional
  { accessType: 'read', recordType: 'Distance'                   }, // optional
];

// The biometric signals the risk model actually uses. We treat Health Connect
// as "ready" only if at least one of these was granted — granting just the
// optional Distance/Calories shouldn't make us claim real data is available.
const CORE_RECORD_TYPES = ['HeartRate', 'Steps', 'SleepSession', 'RestingHeartRate', 'HeartRateVariabilityRmssd'];
function _grantedCoreSignal(granted) {
  const types = new Set((Array.isArray(granted) ? granted : []).map(g => g.recordType));
  return CORE_RECORD_TYPES.some(t => types.has(t));
}

// Map record dataOrigin package → friendly provider name for the UI.
const PROVIDER_NAMES = {
  'com.fitbit.FitbitMobile':            'Fitbit',
  'com.google.android.apps.fitness':    'Google Fit',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.sec.android.app.shealth':        'Samsung Health',
  'com.crrepa.band.dafit':              'Da Fit',
  'com.xiaomi.wearable':                'Mi Fitness',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.huawei.health':                  'Huawei Health',
};
function _friendlyProvider(origin) {
  if (!origin) return null;
  const pkg = typeof origin === 'string' ? origin : origin.packageName || '';
  return PROVIDER_NAMES[pkg] || pkg || null;
}
function _originOf(rec) {
  return rec?.metadata?.dataOrigin?.packageName || rec?.metadata?.dataOrigin || null;
}

// Initialize the native module + ensure permissions exactly once per session.
// Without this, readRecords() returns empty and we'd silently look "broken".
// requestPermission is idempotent — it only prompts the first time.
let _hcReady = false;
async function ensureHealthConnectReady() {
  if (_hcReady) return true;
  try {
    await HC.initialize();
    const granted = await HC.requestPermission(REQUIRED_PERMISSIONS);
    _hcReady = _grantedCoreSignal(granted);
    if (!_hcReady) console.warn('[HealthConnect] No core health permission granted — using simulation');
    return _hcReady;
  } catch (e) {
    console.warn('[HealthConnect] ensureReady failed:', e.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT — call once on app startup. { available, initialized }
// ─────────────────────────────────────────────────────────────────────────────
export async function initHealthConnect() {
  if (!HC_AVAILABLE) {
    console.log('[HealthConnect] Simulation mode (Expo Go / iOS)');
    return { available: false, initialized: false, reason: 'simulation_mode' };
  }
  try {
    const result = await HC.initialize();
    return { available: true, initialized: result };
  } catch (e) {
    return { available: false, initialized: false, reason: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST PERMISSIONS — triggers the system Health Connect permission sheet.
// ─────────────────────────────────────────────────────────────────────────────
export async function requestHealthPermissions() {
  if (!HC_AVAILABLE) return { granted: false, simulation: true };
  try {
    const granted = await HC.requestPermission(REQUIRED_PERMISSIONS);
    _hcReady = _grantedCoreSignal(granted);
    return { granted: _hcReady, permissions: granted };
  } catch (e) {
    return { granted: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH BIOMETRICS  (last 24 hours)
// Returns a normalized payload ready to POST to the backend.
//
// Health Connect record shapes used:
//   HeartRate                  → { samples: [{ beatsPerMinute }] }
//   Steps                      → { count }
//   SleepSession               → { startTime, endTime }
//   RestingHeartRate           → { beatsPerMinute }
//   HeartRateVariabilityRmssd  → { heartRateVariabilityMillis }
//   TotalCaloriesBurned        → { energy: { inKilocalories } }
//   Distance                   → { distance: { inMeters } }
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchBiometrics() {
  const endTime   = new Date();
  const startTime = new Date(endTime - 24 * 60 * 60 * 1000);
  const timeRange = { operator: 'between', startTime: startTime.toISOString(), endTime: endTime.toISOString() };

  // Forced demo mode, or no Health Connect at all → simulate.
  if (_biometricMode === BIOMETRIC_SOURCE.SIMULATED) return _simulatedBiometrics('forced_demo_mode');
  if (!HC_AVAILABLE)                                  return _simulatedBiometrics('health_connect_unavailable');

  // Ensure module init + permissions, else fall back.
  const ready = await ensureHealthConnectReady();
  if (!ready) return _simulatedBiometrics('permission_denied');

  try {
    const [hr, stepsR, sleepR, restR, hrvR, calR, distR] = await Promise.allSettled([
      HC.readRecords('HeartRate',                 { timeRangeFilter: timeRange }),
      HC.readRecords('Steps',                     { timeRangeFilter: timeRange }),
      HC.readRecords('SleepSession',              { timeRangeFilter: timeRange }),
      HC.readRecords('RestingHeartRate',          { timeRangeFilter: timeRange }),
      HC.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter: timeRange }),
      HC.readRecords('TotalCaloriesBurned',       { timeRangeFilter: timeRange }),
      HC.readRecords('Distance',                  { timeRangeFilter: timeRange }),
    ]);
    const recs = (r) => (r.status === 'fulfilled' ? r.value?.records || [] : []);

    // Heart rate (avg of all samples; null when the vendor hasn't synced HR —
    // never fabricate a number and label it real)
    const hrList    = recs(hr);
    const hrSamples = hrList.flatMap(r => r.samples?.map(s => s.beatsPerMinute) || []);
    const avgHr     = hrSamples.length ? hrSamples.reduce((s, v) => s + v, 0) / hrSamples.length : null;

    // Steps (sum)
    const stepList   = recs(stepsR);
    const totalSteps = stepList.reduce((s, r) => s + (r.count || 0), 0);

    // Sleep (sum of session durations, hours)
    const sleepList  = recs(sleepR);
    const sleepHours = sleepList.reduce((sum, r) =>
      sum + (new Date(r.endTime) - new Date(r.startTime)) / 3.6e6, 0);

    // Resting HR (latest; fall back to avg HR only if we actually measured one)
    const restList  = recs(restR);
    const restingHr = restList.length ? (restList[restList.length - 1]?.beatsPerMinute || avgHr) : avgHr;

    // HRV RMSSD (latest, may be absent on Google Fit)
    const hrvList   = recs(hrvR);
    const latestHrv = hrvList.length ? (hrvList[hrvList.length - 1]?.heartRateVariabilityMillis || null) : null;

    // Optional: calories + distance
    const calList   = recs(calR);
    const totalKcal = calList.reduce((s, r) => s + (r.energy?.inKilocalories || 0), 0);
    const distList  = recs(distR);
    const totalMet  = distList.reduce((s, r) => s + (r.distance?.inMeters || 0), 0);

    // FALLBACK RULE: if no real records of any kind, simulate.
    const hasRealData = hrSamples.length > 0 || totalSteps > 0 || sleepList.length > 0 ||
                        hrvList.length > 0 || totalKcal > 0 || totalMet > 0;
    if (!hasRealData) return _simulatedBiometrics('no_records');

    // Identify which app supplied the data (first available origin).
    const provider = _friendlyProvider(
      _originOf(stepList[0]) || _originOf(hrList[0]) || _originOf(sleepList[0]) || _originOf(hrvList[0])
    );

    // Absent signals are null, never 0 — the backend treats 0 as a real
    // measurement and would score "0 steps" as maximum deviation (false
    // alerts when a vendor has synced only some record types, e.g. Fitbit
    // syncs HR before steps land, and never writes HRV to Health Connect).
    return {
      source:           'health_connect',
      isReal:           true,
      provider:         provider || 'Health Connect',
      fetchedAt:        endTime.toISOString(),
      heartRate:        avgHr != null ? Math.round(avgHr) : null,
      restingHeartRate: restingHr != null ? Math.round(restingHr) : null,
      hrv:              latestHrv ? Math.round(latestHrv) : null,
      steps:            stepList.length ? totalSteps : null,
      sleepHours:       sleepList.length ? Math.round(sleepHours * 10) / 10 : null,
      calories:         totalKcal ? Math.round(totalKcal) : null,
      distanceKm:       totalMet ? Math.round(totalMet / 100) / 10 : null,
      windowHours:      24,
    };
  } catch (e) {
    console.warn('[HealthConnect] Fetch failed, simulating:', e.message);
    return _simulatedBiometrics('read_error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC TO BACKEND — fetch → POST /api/passive/biometric-sync
// ─────────────────────────────────────────────────────────────────────────────
export async function syncBiometricsToBackend() {
  try {
    const biometrics = await fetchBiometrics();
    const response   = await api.post('/passive/biometric-sync', biometrics);
    console.log('[HealthConnect] Synced:', biometrics.source, response.data);
    return { success: true, data: response.data, biometrics };
  } catch (e) {
    console.warn('[HealthConnect] Backend sync failed:', e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO CRISIS TRIGGER — deterministic physiological-crash through the REAL
// endpoint so the XGBoost re-score + clinician alert fire reliably on stage.
// Tuned to land physiologicalStressScore ~0.58 (above the 0.55 alert gate).
// ─────────────────────────────────────────────────────────────────────────────
export async function syncCrisisBiometrics() {
  const payload = {
    source: 'health_connect', isReal: false, provider: 'Demo',
    fetchedAt: new Date().toISOString(),
    heartRate: 105, restingHeartRate: 82, hrv: 18, steps: 900, sleepHours: 3.5, windowHours: 24,
  };
  try {
    const response = await api.post('/passive/biometric-sync', payload);
    return { success: true, data: response.data, biometrics: payload };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION MODE  (hidden demo / Expo Go / fallback)
// ─────────────────────────────────────────────────────────────────────────────
function _simulatedBiometrics(reason = 'simulation') {
  const jitter = (base, pct) => Math.round(base * (1 + (Math.random() - 0.5) * pct));
  return {
    source:           'simulation',
    isReal:           false,
    provider:         'Simulation',
    fallbackReason:   reason,
    fetchedAt:        new Date().toISOString(),
    heartRate:        jitter(88, 0.15),
    restingHeartRate: jitter(72, 0.10),
    hrv:              jitter(38, 0.20),
    steps:            jitter(4200, 0.30),
    sleepHours:       Math.round((5 + Math.random() * 1.5) * 10) / 10,
    calories:         jitter(320, 0.25),
    distanceKm:       Math.round((2 + Math.random()) * 10) / 10,
    windowHours:      24,
    note:             `Simulated data (${reason})`,
  };
}
