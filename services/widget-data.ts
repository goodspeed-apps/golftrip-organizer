/**
 * GAS Template, Widget Data Service
 *
 * JS bridge to the native WidgetDataModule (Expo Modules API).
 * Writes key/value pairs to platform-native shared storage so home-screen
 * widgets can read them without opening the app.
 *
 * Platform behaviour:
 * - iOS: UserDefaults via App Group (group.{bundleIdentifier})
 * - Android: SharedPreferences read by the WidgetDataProvider ContentProvider
 * - Web: both functions are no-ops (returns void / null immediately)
 * - Expo Go (module absent): no-ops with console.warn, never throws
 *
 * Patterns:
 * - retryWithBackoff around native bridge calls (bridge can fail transiently)
 * - captureException on unexpected errors (not on graceful no-ops)
 */

import { Platform } from 'react-native';
import { captureException, captureMessage } from '../lib/sentry';
import { retryWithBackoff, isTransientNon4xxError } from '../lib/retry';
import { ServiceError } from './errors';

// ─── Native module ────────────────────────────────────────────────────

type WidgetDataNativeModule = {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
};

// Resolve the native module once at load time (I8: avoids per-call require overhead)
const nativeMod: WidgetDataNativeModule | null = (() => {
  try {
    const { requireNativeModule } = require('expo-modules-core');
    return requireNativeModule('WidgetDataModule') as WidgetDataNativeModule;
  } catch {
    return null;
  }
})();

// ─── Codec ────────────────────────────────────────────────────────────────────

// Note: 'str' is intentionally absent, encode() passes plain strings through
// without an envelope (see encode()). decode() handles legacy '__t':'str' payloads
// via the generic env.v fallthrough branch, so old stored values still round-trip.
type Envelope =
  | { __t: 'num'; v: number }
  | { __t: 'bool'; v: boolean }
  | { __t: 'json'; v: unknown };

const SIZE_WARN_BYTES = 32 * 1024;  // 32 KB
const SIZE_HARD_BYTES = 64 * 1024;  // 64 KB
const encoder = new TextEncoder();

/** Encode any value into a string for the native bridge. */
function encode(value: unknown): string {
  if (typeof value === 'string') {
    // M3: plain strings pass through without an envelope, decode() auto-detects via JSON.parse fallback
    return value;
  }
  if (typeof value === 'number') {
    // C3: NaN and Infinity are silently converted to null by JSON.stringify, reject them explicitly
    if (!Number.isFinite(value)) {
      throw new ServiceError('widget_data_non_finite', 400, 'NaN and Infinity cannot be stored in widget data');
    }
    return JSON.stringify({ __t: 'num', v: value } satisfies Envelope);
  }
  if (typeof value === 'boolean') {
    return JSON.stringify({ __t: 'bool', v: value } satisfies Envelope);
  }
  return JSON.stringify({ __t: 'json', v: value } satisfies Envelope);
}

/** Decode a string from the native bridge back to the original value. */
function decode(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      '__t' in parsed
    ) {
// Cast to a loose type so the legacy 'str' tag (no longer produced by encode()
      // but possibly present in stored data) doesn't trigger TS2367 (M1).
      const env = parsed as { __t: string; v: unknown };
      if (
        env.__t === 'str' || // legacy, encode() no longer produces this, but stored values may have it
        env.__t === 'num' ||
        env.__t === 'bool' ||
        env.__t === 'json'
      ) {
        return env.v;
      }
    }
  } catch {
    // Not JSON or not an envelope, fall through to legacy path
  }
  // Legacy back-compat: return the raw string as-is
  return raw;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist a widget data value by key.
 *
 * Accepts any serializable value, string, number, boolean, object, or array.
 * Values are encoded via a JSON envelope so they round-trip through the
 * native string bridge without loss of type information.
 *
 * After a successful write the native layer calls WidgetCenter / AppWidgetManager
 * to trigger an immediate widget refresh.
 *
 * No-ops silently on web. Warns (does not throw) when the native module is
 * absent (e.g. running inside Expo Go).
 *
 * Throws ServiceError('widget_data_too_large', 413) when the encoded value
 * exceeds 64 KB. Logs a warning (via captureMessage) above 32 KB.
 */
export async function setWidgetData<T>(key: string, value: T): Promise<void> {
  if (Platform.OS === 'web') return;

  const mod = nativeMod;
  if (!mod) {
    console.warn(
      '[widget-data] WidgetDataModule not available (Expo Go or module not linked). ' +
        'setWidgetData is a no-op in this environment.'
    );
    return;
  }

const encoded = encode(value);
  // Early-out: if char count × 4 < threshold, we're guaranteed under the limit
  // even in worst-case UTF-8 encoding (4 bytes per code point). Only pay for
  // TextEncoder.encode() when the string is large enough to matter (I8).
  const byteSize = encoded.length * 4 < SIZE_WARN_BYTES
    ? encoded.length  // cheap approximation, known to be under threshold
    : encoder.encode(encoded).length;

  if (byteSize > SIZE_HARD_BYTES) {
    throw new ServiceError(
      'widget_data_too_large',
      413,
      `[widget-data] Value for key "${key}" exceeds 64 KB limit (${byteSize} bytes). Write rejected.`
    );
  }

  if (byteSize > SIZE_WARN_BYTES) {
    captureMessage(
      `[widget-data] Value for key "${key}" is large (${byteSize} bytes). Consider reducing widget data size.`,
      'warning'
    );
  }

try {
    await retryWithBackoff(() => mod.setItem(key, encoded), {
      shouldRetry: isTransientNon4xxError,
    });
  } catch (err) {
    captureException(err, { service: 'widget-data', action: 'setWidgetData', key });
    throw err;
  }
}

/**
 * Read a widget data value by key.
 *
 * Returns the value typed as `T`, or `null` when the key has not been set yet,
 * or when running on web / Expo Go where the module is unavailable.
 *
 * Legacy raw strings written before the codec was introduced are returned
 * as-is (still typed as `T` via type assertion, callers should assert shape
 * at runtime if strict validation is needed).
 */
export async function getWidgetData<T = unknown>(key: string): Promise<T | null> {
  if (Platform.OS === 'web') return null;

  const mod = nativeMod;
  if (!mod) {
    console.warn(
      '[widget-data] WidgetDataModule not available (Expo Go or module not linked). ' +
        'getWidgetData is a no-op in this environment.'
    );
    return null;
  }

  try {
    const raw = await retryWithBackoff(() => mod.getItem(key), {
      shouldRetry: isTransientNon4xxError,
    });
    if (raw === null) return null;
    return decode(raw) as T;
  } catch (err) {
    captureException(err, { service: 'widget-data', action: 'getWidgetData', key });
    return null;
  }
}