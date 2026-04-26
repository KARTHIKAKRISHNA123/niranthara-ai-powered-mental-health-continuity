// src/services/passiveMonitor.js
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Pedometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { addToOfflineQueue } from '../utils/storage';

const PASSIVE_LOG_TASK = 'PASSIVE_LOG_TASK';

// Register background task
TaskManager.defineTask(PASSIVE_LOG_TASK, async () => {
  try {
    const data = await collectPassiveData();
    await addToOfflineQueue('passiveLogs', data);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("Passive monitor error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerPassiveMonitor = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(PASSIVE_LOG_TASK, {
      minimumInterval: 60 * 60, // 1 hour
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log("Passive monitoring registered");
  } catch (err) {
    console.error("Task register failed:", err);
  }
};

// Data collection logic
const collectPassiveData = async () => {
  let stepsToday = 0;
  let gpsEntropy = 3;
  let accelerometerVariance = null;
  let screenOffMinutes = null;
  let isChargingOvernight = false;
  let notifResponseGapMinutes = null;

  try {
    const isPedometerAvailable = await Pedometer.isAvailableAsync();
    if (isPedometerAvailable) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const pedometerData = await Pedometer.getStepCountAsync(start, end);
      stepsToday = pedometerData.steps;
    }
  } catch (e) {
    console.warn("Pedometer error:", e);
  }

  // Calculate GPS entropy without storing coordinates
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      // Extremely simplified mock entropy calculation for the sake of example. 
      // In real life, this would track location changes over time locally.
      gpsEntropy = Math.abs(location.coords.latitude) % 10; 
    }
  } catch (e) {
     console.warn("Location error:", e);
  }

  const nowHour = new Date().getHours();
  const isOvernight = nowHour >= 22 || nowHour <= 6;

  // Sleep confidence gate: these signals are partially mocked until OS-level integrations are added.
  const sleepSignals = {
    phone_stationary: accelerometerVariance != null ? accelerometerVariance < 0.02 : stepsToday < 50,
    screen_off_duration: screenOffMinutes != null ? screenOffMinutes > 240 : false,
    charging_overnight: isChargingOvernight && isOvernight,
    notification_silence: notifResponseGapMinutes != null ? notifResponseGapMinutes > 360 : false,
  };
  const sleepConfidence = Object.values(sleepSignals).filter(Boolean).length / 4;
  const sleepDisruptionFlag = sleepConfidence > 0.6 && !sleepSignals.phone_stationary;

  return {
    stepsToday,
    gpsEntropy,
    sleepProxyHours: 7, // Would require platform specific sleep APIs
    sleepConfidence,
    sleepSignals,
    sleepDisruptionFlag,
    screenTimeMinutes: 0, // OS restrictions apply
    createdAt: new Date().toISOString()
  };
};
