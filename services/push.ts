/**
 * GAS Template, Push Notification Service
 *
 * Manages Expo push token registration, Supabase upsert/delete, per-category
 * preferences, and deep-link tap routing via expo-router.
 *
 * Patterns:
 * - retryWithBackoff(isTransientNon4xxError) around all Supabase calls
 * - captureException(err, { service: 'push' }) in all catch paths
 * - ServiceError for typed throws
 * - captureEvent for analytics
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { supabase, getCurrentUserId } from '../lib/supabase';
import { retryWithBackoff, isTransientNon4xxError } from '../lib/retry';
import { captureException } from '../lib/sentry';
import { captureEvent } from '../lib/posthog';
import { EVENTS } from '../lib/events';
import { ServiceError } from './errors';
import { type NotificationCategory } from '../types/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { NotificationCategory };

export type NotificationPreferences = Record<NotificationCategory, boolean>;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  transactional: true,
  product: true,
  marketing: false,
};

// ─── Cached token helper ──────────────────────────────────────────────────────

let _cachedToken: string | null = null;

async function getPushToken(): Promise<string> {
  if (_cachedToken) return _cachedToken;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId:
        Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });
    _cachedToken = data;
    return data;
  } catch (err) {
    captureException(err, { service: 'push', action: 'getPushToken' });
    throw new ServiceError('push_token_unavailable', 500, 'Failed to retrieve Expo push token');
  }
}

/** Exported for tests only, clears the module-level token cache. */
export function __clearTokenCache(): void {
  _cachedToken = null;
}

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Request push notification permission from the OS.
 * Returns the resulting permission status string.
 */
export async function requestPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch (err) {
    captureException(err, { service: 'push', action: 'requestPermission' });
    return 'undetermined';
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * Request permission, get the Expo push token, and upsert a row in push_tokens.
 * Returns the token string, or null if permission was denied or no user session.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const permStatus = await requestPermission();
    if (permStatus !== 'granted') {
      return null;
    }

    const expoPushToken = await getPushToken();

    const deviceId = Device.modelName ?? Platform.OS;

    await retryWithBackoff(
      async () =>
        supabase.from('push_tokens').upsert(
          {
            user_id: userId,
            expo_push_token: expoPushToken,
            platform: Platform.OS,
            device_id: deviceId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'expo_push_token' },
        ),
      { shouldRetry: isTransientNon4xxError },
    );

    await captureEvent(EVENTS.push_registered, { platform: Platform.OS });

    return expoPushToken;
  } catch (err) {
    captureException(err, { service: 'push', action: 'registerForPush' });
    throw new ServiceError('push.register_failed', 500, 'Failed to register for push notifications');
  }
}

// ─── Unregister ───────────────────────────────────────────────────────────────

/**
 * Delete the current device's push_tokens row by expo_push_token.
 */
export async function unregister(): Promise<void> {
  try {
    const expoPushToken = await getPushToken();

    await retryWithBackoff(
      async () =>
        supabase
          .from('push_tokens')
          .delete()
          .eq('expo_push_token', expoPushToken),
      { shouldRetry: isTransientNon4xxError },
    );

    __clearTokenCache();
    await captureEvent(EVENTS.push_unregistered, {});
  } catch (err) {
    captureException(err, { service: 'push', action: 'unregister' });
    throw new ServiceError('push.unregister_failed', 500, 'Failed to unregister push token');
  }
}

// ─── Preferences ─────────────────────────────────────────────────────────────

/**
 * Update notification category preferences for the current device token.
 */
export async function updatePreferences(prefs: NotificationPreferences): Promise<void> {
  try {
    const expoPushToken = await getPushToken();

    await retryWithBackoff(
      async () =>
        supabase
          .from('push_tokens')
          .update({ preferences: prefs, updated_at: new Date().toISOString() })
          .eq('expo_push_token', expoPushToken),
      { shouldRetry: isTransientNon4xxError },
    );
  } catch (err) {
    captureException(err, { service: 'push', action: 'updatePreferences' });
    throw new ServiceError('push.preferences_failed', 500, 'Failed to update push preferences');
  }
}

/**
 * Fetch notification category preferences for the current device token.
 * Returns defaults if no row is found.
 */
export async function getPreferences(): Promise<NotificationPreferences> {
  try {
    const expoPushToken = await getPushToken();

    const result = await retryWithBackoff<{ data: { preferences: unknown } | null; error: unknown }>(
      async () =>
        supabase
          .from('push_tokens')
          .select('preferences')
          .eq('expo_push_token', expoPushToken)
          .single(),
      { shouldRetry: isTransientNon4xxError },
    );

    if (result.error || !result.data?.preferences) {
      return { ...DEFAULT_PREFERENCES };
    }

    return result.data.preferences as NotificationPreferences;
  } catch (err) {
    captureException(err, { service: 'push', action: 'getPreferences' });
    return { ...DEFAULT_PREFERENCES };
  }
}

// ─── Deep-link validation ─────────────────────────────────────────────────────

function isValidDeepLink(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.includes('..')) return false;
  return true;
}

// ─── Tap Handler ─────────────────────────────────────────────────────────────

/**
 * Register a listener for notification tap events. Routes to deep links via
 * expo-router when the notification payload contains a valid `deepLink` path.
 *
 * Returns an unsubscribe function, call it on component unmount.
 */
export function initPushHandlers(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    try {
      const data = response.notification.request.content.data as Record<string, unknown>;

      captureEvent(EVENTS.push_tapped, { hasDeepLink: !!data?.deepLink }).catch(() => {});

      const deepLink = data?.deepLink;
      if (typeof deepLink === 'string' && isValidDeepLink(deepLink)) {
        router.push(deepLink as `/${string}`);
      }
    } catch (err) {
      captureException(err, { service: 'push', action: 'initPushHandlers.tap' });
    }
  });

  return () => subscription.remove();
}
