// src/services/NotificationService.js
// Patient-side notifications: JITAI pushes (server-sent) and the daily
// check-in reminder (scheduled locally on the device).
//
// This is the attrition lever. Attrition is rarely a decision — it is a patient
// who quietly stops opening the app. A check-in is also the measurement the
// outcome loop depends on, so a missed check-in costs the data AND the patient.

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Foreground presentation. SDK 54 renamed `shouldShowAlert` to
// `shouldShowBanner` / `shouldShowList`; both are set so the handler behaves
// the same on either version of the notification API.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

const CHECK_IN_IDENTIFIER = 'niranthara-daily-checkin';

// Resolved from app.json → expo.extra.eas.projectId. This used to be the
// literal string "YOUR_EXPO_PROJECT_ID", which makes getExpoPushTokenAsync
// throw — so no token was ever produced, let alone stored.
function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}

/**
 * Ask for permission and return an Expo push token, or null.
 * Returns null rather than throwing — a patient who declines notifications must
 * still get a fully working app.
 */
export async function registerForPushNotificationsAsync() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Niranthara',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C97B84',
      });
    }

    // Emulators cannot receive push. This was previously guarded with
    // `Device.isDevice` from expo-device — which is NOT in package.json, so the
    // import threw and took the whole module down before any of this ran.
    if (Constants.isDevice === false) {
      console.log('[push] physical device required for push notifications');
      return null;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[push] permission not granted');
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[push] no EAS projectId in app.json — cannot mint a token');
      return null;
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn('[push] registration failed:', err?.message);
    return null;
  }
}

/**
 * Persist the token server-side.
 *
 * Posts to a dedicated endpoint, not `/auth/update-profile` — that route has a
 * strict field allow-list which never included a token field, so the previous
 * implementation sent the token and the server silently discarded it.
 */
export async function syncPushTokenToBackend(apiClient, token) {
  if (!token) return false;
  try {
    await apiClient.post('/auth/push-token', { pushToken: token, platform: Platform.OS });
    return true;
  } catch (error) {
    console.warn('[push] token sync failed:', error?.message);
    return false;
  }
}

/**
 * Daily check-in reminder, scheduled on the device.
 *
 * Local rather than server-sent on purpose: it fires with no network, costs no
 * backend work, and survives the push token being absent. The server-sent JITAI
 * push is the *adaptive* nudge; this is the floor beneath it.
 *
 * Wording is deliberately generic — a lock-screen preview is visible to anyone
 * holding the phone, so it must never disclose a mental-health context.
 */
export async function scheduleDailyCheckInReminder(hour = 20, minute = 0) {
  try {
    // Cancel first, or every app launch stacks another identical reminder.
    await cancelDailyCheckInReminder();

    await Notifications.scheduleNotificationAsync({
      identifier: CHECK_IN_IDENTIFIER,
      content: {
        title: 'Niranthara',
        body:  'A quick 30-second check-in keeps your insights accurate.',
        data:  { screen: 'Home', type: 'checkin_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return true;
  } catch (err) {
    console.warn('[push] could not schedule reminder:', err?.message);
    return false;
  }
}

export async function cancelDailyCheckInReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync(CHECK_IN_IDENTIFIER);
  } catch {
    // No existing reminder with that identifier — expected on first run.
  }
}

/**
 * One call to wire everything up once the user is authenticated.
 * Safe on every launch: token registration is idempotent server-side and the
 * reminder is cancelled before being re-scheduled.
 */
export async function initPatientNotifications(apiClient) {
  const token = await registerForPushNotificationsAsync();
  if (token) await syncPushTokenToBackend(apiClient, token);
  await scheduleDailyCheckInReminder();
  return token;
}
