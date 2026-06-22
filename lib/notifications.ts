/**
 * GAS Template, Push Notifications
 *
 * Expo Notifications wrapper: permission registration, local scheduling,
 * badge management, and notification listeners.
 *
 * Token registration upserts to a `push_tokens` table in Supabase.
 * Android notification channels are created from gasConfig.features.pushNotifications.channels.
 *
 * Config: gasConfig.features.pushNotifications for channels and enabled flag.
 *
 * Dependencies: expo-notifications, expo-device
 *
 * Web: All functions are no-ops since push notifications are not supported.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isWeb } from './platform';
import { captureEvent } from './posthog';
import { addBreadcrumb, captureException } from './sentry';
import { supabase } from './supabase';
import { gasConfig } from '../gas.config';

// Conditionally import native-only modules
let ExpoNotifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
if (!isWeb) {
  try {
    ExpoNotifications = require('expo-notifications');
    Device = require('expo-device');
  } catch {
    // Module not available
  }
}

// --- Default notification handler (native only) ---
if (!isWeb && ExpoNotifications) {
  ExpoNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Request notification permissions and register the push token.
 *
 * - Only works on physical devices (not simulators).
 * - Creates Android notification channels from config.
 * - Upserts the Expo push token to the `push_tokens` Supabase table.
 *
 * @returns The push token string, or null if permission denied / not a device / web.
 */
export async function requestPermissionAndRegister(
  userId: string
): Promise<string | null> {
  if (isWeb || !ExpoNotifications || !Device) return null;
  if (!Device.isDevice) return null;

  captureEvent('push_permission_requested');

  const { status: existing } = await ExpoNotifications.getPermissionsAsync();
  const finalStatus =
    existing === 'granted'
      ? existing
      : (await ExpoNotifications.requestPermissionsAsync()).status;

  captureEvent('push_permission_result', { status: finalStatus });

  if (finalStatus !== 'granted') {
    addBreadcrumb('notification', 'Push permission denied');
    return null;
  }

  // Create Android notification channels from config
  if (Platform.OS === 'android') {
    const channels = gasConfig.features.pushNotifications.channels;
    for (const channel of channels) {
      if (typeof channel !== 'string') continue;
      try {
        await ExpoNotifications.setNotificationChannelAsync(channel, {
          name: channel.charAt(0).toUpperCase() + channel.slice(1),
          importance: ExpoNotifications.AndroidImportance.MAX,
        });
      } catch (e) {
        captureException(e, { component: 'notifications', action: 'setChannel', channel });
      }
    }
  }

  const token = (
    await ExpoNotifications.getExpoPushTokenAsync({
      projectId:
        Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    })
  ).data;

  // Persist token in Supabase for server-side push
  try {
    await supabase.from('push_tokens').upsert({
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>);
  } catch (e) {
    captureException(e, { component: 'notifications', action: 'upsert_token' });
  }

  captureEvent('push_token_registered', { platform: Platform.OS });
  addBreadcrumb('notification', 'Push token registered');

  return token;
}

/**
 * The Android channel a local notification is posted to. Android 8+ silently
 * DROPS any notification whose channel does not exist, and a channel is
 * otherwise only created inside requestPermissionAndRegister(), which a screen
 * that asks for the OS permission directly never reaches, and which also
 * early-returns on a simulator/emulator (`!Device.isDevice`). So local-only
 * notifications would never display on Android. The two helpers below guarantee
 * the channel exists and attach it to the trigger.
 */
const LOCAL_CHANNEL_ID = gasConfig.features.pushNotifications.channels?.[0] ?? 'default';
let localChannelEnsured = false;

/** Idempotently create the Android local-notification channel. No-op off Android. */
async function ensureLocalChannel(): Promise<void> {
  if (isWeb || !ExpoNotifications || Platform.OS !== 'android' || localChannelEnsured) return;
  try {
    await ExpoNotifications.setNotificationChannelAsync(LOCAL_CHANNEL_ID, {
      name: LOCAL_CHANNEL_ID.charAt(0).toUpperCase() + LOCAL_CHANNEL_ID.slice(1),
      importance: ExpoNotifications.AndroidImportance.MAX,
    });
    localChannelEnsured = true;
  } catch (e) {
    captureException(e, { component: 'notifications', action: 'ensureLocalChannel' });
  }
}

/**
 * Attach the Android channel to a trigger so the notification actually displays.
 * On Android a bare `{ channelId }` trigger fires immediately on that channel
 * (ChannelAwareTriggerInput), so a null/immediate trigger maps cleanly. Off
 * Android the trigger is returned unchanged (null = immediate).
 */
function withAndroidChannel(trigger: unknown): unknown {
  if (Platform.OS !== 'android') return trigger ?? null;
  if (trigger && typeof trigger === 'object') {
    return { ...(trigger as Record<string, unknown>), channelId: LOCAL_CHANNEL_ID };
  }
  return { channelId: LOCAL_CHANNEL_ID };
}

/**
 * Schedule a local notification with a custom trigger.
 *
 * On failure, throws an Error whose message includes the underlying expo-notifications
 * error AND the trigger+channel+platform context. Test-alert screens should surface
 * `err.message` inline (not a generic "Test Failed") so the cause is debuggable
 * without Sentry, which is a no-op in apps that haven't set EXPO_PUBLIC_SENTRY_DSN.
 *
 * @returns The notification identifier (can be used to cancel), or empty string on web.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: unknown
): Promise<string> {
  if (isWeb || !ExpoNotifications) return '';
  await ensureLocalChannel();
  void captureEvent('local_notification_scheduled', { title });
  const resolvedTrigger = withAndroidChannel(trigger);
  try {
    return await ExpoNotifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: resolvedTrigger as import('expo-notifications').NotificationTriggerInput,
    });
  } catch (e) {
    const orig = e instanceof Error ? e.message : String(e);
    const ctx = `platform=${Platform.OS} channel=${LOCAL_CHANNEL_ID} triggerType=${
      resolvedTrigger && typeof resolvedTrigger === 'object'
        ? ((resolvedTrigger as { type?: string }).type ?? Object.keys(resolvedTrigger).join(','))
        : String(resolvedTrigger)
    }`;
    captureException(e, { component: 'notifications', action: 'scheduleLocalNotification', ctx });
    throw new Error(`scheduleLocalNotification failed (${ctx}): ${orig}`);
  }
}

/**
 * Listen for notifications received while the app is in the foreground.
 */
export function addNotificationReceivedListener(
  handler: (n: unknown) => void
) {
  if (isWeb || !ExpoNotifications) return { remove: () => {} };
  return ExpoNotifications.addNotificationReceivedListener(handler as (n: import('expo-notifications').Notification) => void);
}

/**
 * Listen for user interactions with notifications (taps).
 * Auto-navigates if `data.deepLink` is present in the notification payload.
 */
export function addNotificationResponseListener(
  handler?: (r: unknown) => void
) {
  if (isWeb || !ExpoNotifications) return { remove: () => {} };
  return ExpoNotifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.deepLink && typeof data.deepLink === 'string') {
      try {
        const { router } = require('expo-router');
        router.push(data.deepLink);
        addBreadcrumb('notification', 'Deep link navigated', { deepLink: data.deepLink });
      } catch {
        // Router not available
      }
    }
    handler?.(response);
  });
}

/**
 * Get the current app badge count.
 */
export async function getBadgeCount(): Promise<number> {
  if (isWeb || !ExpoNotifications) return 0;
  return ExpoNotifications.getBadgeCountAsync();
}

/**
 * Set the app badge count (iOS dock icon, Android launcher if supported).
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (isWeb || !ExpoNotifications) return;
  await ExpoNotifications.setBadgeCountAsync(count);
}

/**
 * Schedule a rich notification with optional image and deep link data.
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @param opts - Optional: imageUrl (iOS attachment), categoryId (iOS action buttons), data (deep link payload)
 * @param trigger - When to show (null = immediately)
 */
export async function scheduleRichNotification(
  title: string,
  body: string,
  opts?: { imageUrl?: string; categoryId?: string; data?: Record<string, unknown> },
  trigger?: unknown
): Promise<string> {
  if (isWeb || !ExpoNotifications) return '';
  await ensureLocalChannel();

  const content: Record<string, unknown> = { title, body, sound: true };
  if (opts?.categoryId) content.categoryIdentifier = opts.categoryId;
  if (opts?.data) content.data = opts.data;

  // iOS supports attachments for images in notifications
  if (opts?.imageUrl && Platform.OS === 'ios') {
    content.attachments = [{ url: opts.imageUrl }];
  }

  return ExpoNotifications.scheduleNotificationAsync({
    content: content as import('expo-notifications').NotificationContentInput,
    trigger: withAndroidChannel(trigger) as import('expo-notifications').NotificationTriggerInput,
  });
}

/**
 * Register iOS notification categories with action buttons.
 * Categories define interactive actions the user can take from the notification.
 *
 * @example
 * registerNotificationCategories([
 *   { identifier: 'MESSAGE', actions: [
 *     { identifier: 'reply', buttonTitle: 'Reply', isDestructive: false },
 *     { identifier: 'dismiss', buttonTitle: 'Dismiss', isDestructive: true },
 *   ]}
 * ]);
 */
export async function registerNotificationCategories(
  categories: Array<{ identifier: string; actions: Array<{ identifier: string; buttonTitle: string; isDestructive?: boolean }> }>
): Promise<void> {
  if (isWeb || !ExpoNotifications || Platform.OS !== 'ios') return;
  try {
    for (const cat of categories) {
      await ExpoNotifications.setNotificationCategoryAsync(cat.identifier, cat.actions.map(a => ({
        identifier: a.identifier,
        buttonTitle: a.buttonTitle,
        isDestructive: a.isDestructive ?? false,
        isAuthenticationRequired: false,
      })));
    }
  } catch (e) {
    captureException(e, { component: 'notifications', action: 'registerCategories' });
  }
}
