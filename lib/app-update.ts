/**
 * GAS Template, App Update Utilities
 *
 * Wraps expo-updates API with error handling.
 */

import * as Updates from 'expo-updates';
import { captureException, addBreadcrumb } from './sentry';

/** Check if an OTA update is available. */
export async function checkForUpdate(): Promise<{ available: boolean; manifest?: Record<string, unknown> }> {
  try {
    if (!Updates.isEnabled) return { available: false };
    const result = await Updates.checkForUpdateAsync();
    return { available: result.isAvailable, manifest: result.manifest as Record<string, unknown> | undefined };
  } catch (err) {
    captureException(err, { component: 'app-update', action: 'check' });
    return { available: false };
  }
}

/** Fetch the available update. Returns true if successful. */
export async function fetchUpdate(): Promise<boolean> {
  try {
    await Updates.fetchUpdateAsync();
    addBreadcrumb('app-update', 'Update fetched');
    return true;
  } catch (err) {
    captureException(err, { component: 'app-update', action: 'fetch' });
    return false;
  }
}

/** Apply the fetched update by reloading the app. */
export async function applyUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (err) {
    captureException(err, { component: 'app-update', action: 'apply' });
  }
}

// ── Crash-on-launch detection + operator alert ───────────────────────────────
//
// A bad OTA update can crash the app before the first frame. expo-updates 55
// has no client-side "force embedded bundle" API (rollbackToEmbeddedAsync was
// removed), so the platform-correct recovery is operator-driven: the operator
// ships `eas update --branch <b> --rollback`, OR the binary's
// `fallbackToCacheTimeout: 0` falls back to the embedded bundle on DOWNLOAD
// failure. What we CAN do client-side is reliably DETECT a crash-on-launch on
// an OTA bundle and alert (Sentry + analytics) so a bad OTA is caught in
// minutes instead of via store reviews.
//
//   1. On every launch we set a "pending launch" sentinel in AsyncStorage.
//   2. markLaunchHealthy() clears it ~4s after the UI renders successfully.
//   3. If the next launch still sees the sentinel, the previous boot crashed.
//      If we're on an OTA bundle (not embedded), report it as a likely-bad OTA
//      and attempt to pull a newer (fixed) update if the operator shipped one.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureEvent } from './posthog';
import { EVENTS } from './events';

const PENDING_LAUNCH_KEY = '@gas:pending_launch';

/**
 * Call once at app startup, BEFORE rendering. Detects a crash-on-launch from
 * the previous boot. If detected on an OTA bundle, reports it and tries to
 * fetch a newer update (the operator's fix). Returns true if a recovery
 * reload is imminent.
 */
export async function guardLaunch(): Promise<boolean> {
  try {
    if (!Updates.isEnabled) return false;
    const pending = await AsyncStorage.getItem(PENDING_LAUNCH_KEY);
    if (pending && !Updates.isEmbeddedLaunch) {
      // Previous launch crashed before becoming healthy, and we're on an OTA.
      addBreadcrumb('app-update', 'Detected crash-on-launch on OTA bundle');
      captureException(new Error('OTA crash-on-launch detected'), {
        component: 'app-update',
        action: 'guardLaunch',
        updateId: Updates.updateId ?? 'unknown',
      });
      try { captureEvent(EVENTS.ota_rolled_back, { updateId: Updates.updateId ?? 'unknown' }); } catch { /* best-effort */ }
      await AsyncStorage.removeItem(PENDING_LAUNCH_KEY);
      // Try to recover by pulling a newer (fixed) update if one exists.
      const { available } = await checkForUpdate();
      if (available && (await fetchUpdate())) {
        await Updates.reloadAsync();
        return true; // reload imminent
      }
      // No fix available yet, fall through and let this launch run; the
      // operator has been alerted and can ship `eas update --rollback`.
    }
    // Arm the sentinel for this launch.
    await AsyncStorage.setItem(PENDING_LAUNCH_KEY, String(Date.now()));
    return false;
  } catch (err) {
    captureException(err, { component: 'app-update', action: 'guardLaunch' });
    return false;
  }
}

/**
 * Call once the app has successfully rendered (e.g. 4s after the root mounts).
 * Clears the pending-launch sentinel so this launch is recorded as healthy.
 */
export async function markLaunchHealthy(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_LAUNCH_KEY);
  } catch {
    // best-effort, a failure here only risks a spurious alert next launch
  }
}
