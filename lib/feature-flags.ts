/**
 * GAS Template, Feature Flags
 *
 * Client-side feature flag reader backed by the `feature_flags` Supabase table.
 * Provides a React hook, a sync getter, and a force-refresh function.
 *
 * Evaluation order:
 *   1. kill_all flag → everything false
 *   2. enabled=false → false
 *   3. segments.countries filter → false if country not in list
 *   4. segments.user_segment filter → false if segment doesn't match
 *   5. rollout_percentage < 100 → bucket(userId:key) % 100 < rollout_percentage
 *   6. else → enabled
 *
 * Config: reads from Supabase `feature_flags` table (public read RLS).
 * Dependencies: expo-secure-store, react, react-native
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { cacheQuery, getCached, LONG_CACHE_MS } from './offline';
import { retryWithBackoff, isTransientNon4xxError } from './retry';
import { addBreadcrumb } from './sentry';
import { assignBucket } from './hash';

// ---

const DEVICE_ID_KEY = 'gas_feature_flag_device_id';
const FLAGS_CACHE_KEY = 'feature_flags_snapshot';
const TTL_MS = 60_000;

interface FlagRow {
  key: string;
  enabled: boolean;
  rollout_percentage: number;
  segments: {
    countries?: string[];
    user_segment?: string;
  };
  metadata?: Record<string, unknown>;
}

interface UserContext {
  userId: string;
  country?: string;
  segment?: string;
}

// In-memory state
let snapshot: Record<string, FlagRow> = {};
let lastFetchedAt = 0;
let fetchPromise: Promise<void> | null = null;
let userCtx: UserContext | null = null;

// Pub/sub listeners for snapshot changes
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const fn of listeners) fn();
}

// --- Identity ---

let deviceId: string | null = null;

// In-memory fallback for platforms where SecureStore and localStorage are unavailable
let memoryDeviceId: string | null = null;

function generateUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  // RFC4122-shaped fallback for environments without Web Crypto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getOrCreateDeviceId(): Promise<string> {
  if (deviceId) return deviceId;

  if (Platform.OS === 'web') {
    // localStorage is available on web
    try {
      const stored = localStorage.getItem(DEVICE_ID_KEY);
      if (stored) {
        deviceId = stored;
        return deviceId;
      }
      const id = generateUuid();
      localStorage.setItem(DEVICE_ID_KEY, id);
      deviceId = id;
      return deviceId;
    } catch {
      // localStorage unavailable (e.g. private browsing restrictions)
      if (memoryDeviceId) {
        deviceId = memoryDeviceId;
        return deviceId;
      }
      deviceId = generateUuid();
      memoryDeviceId = deviceId;
      return deviceId;
    }
  }

  // Native: use SecureStore with in-memory fallback
  try {
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) {
      deviceId = stored;
      return deviceId;
    }
    const id = generateUuid();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    deviceId = id;
    return deviceId;
  } catch {
    if (memoryDeviceId) {
      deviceId = memoryDeviceId;
      return deviceId;
    }
    deviceId = generateUuid();
    memoryDeviceId = deviceId;
    return deviceId;
  }
}

// --- Bucket ---

// Memoize bucket per (userId, key): the hash is stable for a given pair, so
// every background snapshot refresh re-hashing the same inputs is wasted work.
// Invalidated in setUserContext when userId changes.
const bucketCache = new Map<string, number>();

function bucket(userId: string, key: string): number {
  const cacheKey = `${userId}:${key}`;
  const cached = bucketCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const value = assignBucket(userId, key, 100);
  bucketCache.set(cacheKey, value);
  return value;
}

// --- Fetch ---

async function fetchFlags(): Promise<void> {
  let data: FlagRow[] | null = null;
  try {
    // Wrap the supabase call in retry: a single transient failure otherwise
    // pins flags at defaults for the full TTL window.
const result = await retryWithBackoff(async () => {
      const { data: rows, error } = await supabase
        .from('feature_flags')
        .select('key, description, enabled, rollout_percentage, segments');
      if (error) throw error;
      return rows as FlagRow[] | null;
    }, {
      maxRetries: 2,
      baseDelay: 500,
shouldRetry: isTransientNon4xxError,
    });
    data = result;
  } catch (err) {
    // Final failure after retries, drop a breadcrumb so the silent default
    // fallback is debuggable, then preserve graceful behavior.
    addBreadcrumb('feature-flags', 'fetch_failed: ' + String(err));
    return;
  }

  if (!data) return;

  const next: Record<string, FlagRow> = {};
  for (const row of data) {
    next[row.key] = row;
  }
  snapshot = next;
  lastFetchedAt = Date.now();
  notifyListeners();

  // Persist snapshot for cold-start fallback. Don't error if cache write fails.
  try {
    await cacheQuery(FLAGS_CACHE_KEY, { rows: data }, LONG_CACHE_MS);
  } catch { /* graceful degradation */ }
}

function isStale(): boolean {
  return Date.now() - lastFetchedAt > TTL_MS;
}

let hydratedFromCache = false;
async function hydrateFromCache(): Promise<void> {
  if (hydratedFromCache) return;
  hydratedFromCache = true;
  try {
    const cached = await getCached<{ rows: FlagRow[] }>(FLAGS_CACHE_KEY);
    if (cached?.data?.rows && Object.keys(snapshot).length === 0) {
      const next: Record<string, FlagRow> = {};
      for (const row of cached.data.rows) {
        next[row.key] = row;
      }
      snapshot = next;
      // Leave lastFetchedAt = 0 so background refresh still fires.
      notifyListeners();
    }
  } catch { /* graceful degradation */ }
}

async function ensureFresh(): Promise<void> {
  await hydrateFromCache();
  if (!isStale()) return;
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetchFlags().finally(() => { fetchPromise = null; });
  return fetchPromise;
}

// --- Evaluation ---

function evaluate(row: FlagRow, userId: string, country?: string, segment?: string): boolean {
  if (!row.enabled) return false;

  const { countries, user_segment } = row.segments ?? {};

  if (countries && countries.length > 0) {
    if (!country || !countries.includes(country)) return false;
  }

  if (user_segment !== undefined) {
    if (segment !== user_segment) return false;
  }

  if (row.rollout_percentage < 100) {
    return bucket(userId, row.key) < row.rollout_percentage;
  }

  return true;
}

function resolveFlag(key: string, defaultValue: boolean): boolean {
  // kill_all short-circuits everything
  const killAll = snapshot['kill_all'];
  if (killAll?.enabled === true) return false;

  const row = snapshot[key];
  if (!row) return defaultValue;

  const uid = userCtx?.userId ?? (deviceId ?? 'anonymous');
  return evaluate(row, uid, userCtx?.country, userCtx?.segment);
}

// --- Public API ---

/**
 * Set identity context for flag evaluation. Call from auth state listener.
 */
export function setUserContext(userId: string, country?: string, segment?: string): void {
  // userId change invalidates every cached (userId, key) bucket entry.
  if (userCtx?.userId !== userId) {
    bucketCache.clear();
  }
  userCtx = { userId, country, segment };
}

// Singleton for concurrent refreshFlags() callers so we don't double-fire.
let pendingRefresh: Promise<void> | null = null;

/**
 * Force refetch of flags from Supabase. Awaitable.
 *
 * If a fetch is already in-flight, waits for it to finish then fires a new
 * fetch. Concurrent callers share the same pending refresh, they don't each
 * trigger a new fetch.
 */
export async function refreshFlags(): Promise<void> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = (async () => {
    if (fetchPromise) {
      await fetchPromise.catch(() => { /* in-flight error swallowed by fetchFlags */ });
    }
    lastFetchedAt = 0;
    await ensureFresh();
  })().finally(() => { pendingRefresh = null; });
  return pendingRefresh;
}

/**
 * Sync read from in-memory snapshot. Returns defaultValue for unknown flags.
 * Triggers a background refresh if the cache is stale.
 */
export function getFlag(key: string, defaultValue = false): boolean {
  // Kick off background refresh without blocking
  if (isStale()) {
    ensureFresh().catch(() => { /* silent */ });
  }
  return resolveFlag(key, defaultValue);
}

/**
 * React hook that subscribes to flag state and re-renders on background refreshes.
 */
export function useFlag(key: string, defaultValue = false): boolean {
  const [value, setValue] = useState<boolean>(() => resolveFlag(key, defaultValue));

  useEffect(() => {
    let cancelled = false;

    // Update value after ensuring fresh data
    ensureFresh().then(() => {
      if (!cancelled) {
        setValue((prev) => {
          const next = resolveFlag(key, defaultValue);
          return prev === next ? prev : next;
        });
      }
    }).catch(() => { /* silent */ });

    // Subscribe to future snapshot changes (background refreshes)
    const onUpdate = () => {
      if (!cancelled) {
        setValue((prev) => {
          const next = resolveFlag(key, defaultValue);
          return prev === next ? prev : next;
        });
      }
    };
    listeners.add(onUpdate);

    return () => {
      cancelled = true;
      listeners.delete(onUpdate);
    };
    // defaultValue intentionally omitted, callers pass a constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return value;
}

/**
 * Populate deviceId from persistent storage. Call during app init.
 * Subsequent reads are synchronous from the module-level variable.
 */
export async function initDeviceId(): Promise<void> {
  await getOrCreateDeviceId();
}

// Reset all module state for test isolation. Only available in test environments.
export function __resetForTesting(): void {
  if (process.env.NODE_ENV !== 'test') return;
  snapshot = {};
  lastFetchedAt = 0;
  fetchPromise = null;
  pendingRefresh = null;
  userCtx = null;
  deviceId = null;
  memoryDeviceId = null;
  hydratedFromCache = false;
  listeners.clear();
  bucketCache.clear();
}

export function __getListenersForTesting(): Set<() => void> {
  if (process.env.NODE_ENV !== 'test') throw new Error('test-only');
  return listeners;
}
