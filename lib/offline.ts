/**
 * GAS Template, Offline Cache & Mutation Queue
 *
 * Provides AsyncStorage-backed cache with TTL (stale detection) and a
 * write-ahead mutation queue for offline-first operations.
 *
 * When the device is offline, mutations are queued. When connectivity
 * returns, call flushQueue() with an executor to replay them.
 *
 * Config: gasConfig.features.offlineSync controls which entities are cached
 * and the sync strategy (on_reconnect vs periodic).
 *
 * Encryption: When gasConfig.features.offlineSync.encrypted is true, the
 * mutation queue is stored in expo-secure-store instead of AsyncStorage.
 * This provides hardware-backed encryption (Keychain on iOS, Keystore on
 * Android). Falls back to AsyncStorage if the data exceeds secure-store
 * limits (~2KB) or if expo-secure-store is not available.
 *
 * Dependencies: @react-native-async-storage/async-storage, expo-secure-store (optional)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureEvent } from './posthog';
import { addBreadcrumb } from './sentry';
import { gasConfig } from '../gas.config';

// Try to require expo-secure-store for encrypted queue storage
let SecureStore: typeof import('expo-secure-store') | null = null;
try { SecureStore = require('expo-secure-store'); } catch { /* not installed */ }

// Uses app slug as prefix to avoid key collisions across GAS apps.
const CACHE_PREFIX = `@${gasConfig.app.slug}:cache:`;
const QUEUE_KEY = `@${gasConfig.app.slug}:write_queue`;

// Secure store has a ~2KB value limit on most platforms
const SECURE_STORE_MAX_BYTES = 2048;
const MAX_QUEUE_SIZE = 100;

// Module-level lock to prevent concurrent flushQueue calls
let flushing = false;

// Sample cache analytics events at 10% to reduce PostHog noise
const shouldSampleCacheEvent = () => Math.random() < 0.1;

// Check if encrypted queue storage is enabled and available
const isEncryptedQueue = !!(
  (gasConfig.features.offlineSync as any)?.encrypted &&
  SecureStore
);

// ─── Encrypted Queue Storage Helpers ─────────────────────────────────────────

/**
 * Read the mutation queue from storage.
 * Uses SecureStore if encryption is enabled and data fits, else AsyncStorage.
 */
async function readQueue(): Promise<string | null> {
  if (isEncryptedQueue && SecureStore) {
    try {
      const secure = await SecureStore.getItemAsync(QUEUE_KEY);
      if (secure !== null) return secure;
      // Fallback: check AsyncStorage in case data was migrated or too large
    } catch {
      // SecureStore failed, fall through to AsyncStorage
    }
  }
  return AsyncStorage.getItem(QUEUE_KEY);
}

/**
 * Write the mutation queue to storage.
 * Uses SecureStore if encryption is enabled and data fits within limits,
 * otherwise falls back to AsyncStorage.
 */
async function writeQueue(data: string): Promise<void> {
  if (isEncryptedQueue && SecureStore) {
    // SecureStore has a value size limit (~2KB). If the queue exceeds it,
    // fall back to AsyncStorage and log a breadcrumb.
    if (data.length <= SECURE_STORE_MAX_BYTES) {
      try {
        await SecureStore.setItemAsync(QUEUE_KEY, data);
        return;
      } catch {
        // SecureStore write failed, fall through to AsyncStorage
        addBreadcrumb('offline', 'SecureStore write failed, falling back to AsyncStorage');
      }
    } else {
      addBreadcrumb('offline', 'Queue exceeds SecureStore limit, using AsyncStorage', {
        size: String(data.length),
        limit: String(SECURE_STORE_MAX_BYTES),
      });
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, data);
}

/**
 * Remove the mutation queue from storage.
 * Clears from both stores to handle migration edge cases.
 */
async function removeQueue(): Promise<void> {
  const promises: Promise<void>[] = [AsyncStorage.removeItem(QUEUE_KEY)];
  if (isEncryptedQueue && SecureStore) {
    promises.push(
      SecureStore.deleteItemAsync(QUEUE_KEY).catch(() => { /* ignore */ })
    );
  }
  await Promise.all(promises);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export interface MutationPayload {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body: Record<string, unknown>;
  retries: number;
}

// ─── Cache Operations ────────────────────────────────────────────────────────

/**
 * Cache a query result with a time-to-live.
 *
 * @param key - Cache key (e.g., entity name or query identifier)
 * @param data - The data to cache (must be JSON-serializable)
 * @param ttlMs - Time-to-live in milliseconds
 */
export async function cacheQuery<T>(
  key: string,
  data: T,
  ttlMs: number
): Promise<void> {
  const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttlMs };
  await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
}

/**
 * Retrieve a cached query result.
 *
 * @returns Object with data and stale flag, or null if not cached.
 *   stale=true means the TTL has expired but data is still usable
 *   for optimistic display while a fresh fetch runs.
 */
export async function getCached<T>(
  key: string
): Promise<{ data: T; stale: boolean } | null> {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
  if (!raw) {
    if (shouldSampleCacheEvent()) captureEvent('cache_miss', { key });
    return null;
  }

  let entry: CacheEntry<T>;
  try {
    entry = JSON.parse(raw);
  } catch {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    if (shouldSampleCacheEvent()) captureEvent('cache_corrupted', { key });
    return null;
  }

  const age = Date.now() - entry.timestamp;
  const stale = age > entry.ttlMs;

  // Evict entries older than 2× TTL, too stale even for SWR
  if (age > entry.ttlMs * 2) {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    if (shouldSampleCacheEvent()) captureEvent('cache_evicted', { key, age_ms: age });
    return null;
  }

  if (stale) {
    if (shouldSampleCacheEvent()) captureEvent('cache_expired', { key, age_ms: age });
  } else {
    if (shouldSampleCacheEvent()) captureEvent('cache_hit', { key });
  }
  return { data: entry.data, stale };
}

/**
 * Remove a specific cache entry.
 */
export async function clearCache(key: string): Promise<void> {
  await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
}

/**
 * Memoize a loader behind the same persistent cache: returns cached data
 * (fresh or stale) when present, otherwise invokes `loader`, writes the
 * result with the given TTL, and returns it. On loader failure, returns
 * stale data if available so we degrade gracefully on transient errors.
 *
 * Use this when you want stale-while-revalidate semantics with on-disk
 * persistence and telemetry, rather than re-rolling an in-memory Map
 * (see lib/admin.ts).
 */
export async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const cached = await getCached<T>(key);
  if (cached && !cached.stale) return cached.data;
  try {
    const fresh = await loader();
    await cacheQuery(key, fresh, ttlMs);
    return fresh;
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}

// ─── Mutation Queue ──────────────────────────────────────────────────────────

/**
 * Queue a mutation for later execution (offline-first pattern).
 * Each mutation gets a retry counter starting at 0.
 *
 * When encrypted queue storage is enabled, the queue is stored in
 * expo-secure-store (hardware-backed encryption) with automatic
 * fallback to AsyncStorage if data exceeds size limits.
 */
export async function queueMutation(
  payload: Omit<MutationPayload, 'retries'>
): Promise<void> {
  const raw = await readQueue();
  let queue: MutationPayload[];
  try {
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    queue = [];
    captureEvent('offline_queue_corrupted', { action: 'queue_mutation' });
  }
  queue.push({ ...payload, retries: 0 });

  if (queue.length > MAX_QUEUE_SIZE) {
    const dropped = queue.length - MAX_QUEUE_SIZE;
    queue = queue.slice(-MAX_QUEUE_SIZE);
    captureEvent('offline_queue_overflow', { dropped, max: MAX_QUEUE_SIZE });
  }

  await writeQueue(JSON.stringify(queue));
  addBreadcrumb('offline', 'Mutation queued', {
    endpoint: payload.endpoint,
    encrypted: String(isEncryptedQueue),
  });
}

/**
 * Flush the mutation queue by executing each mutation in order.
 *
 * - Successful mutations are removed from the queue.
 * - Failed mutations are retried up to 5 times, then dropped.
 * - Call this on reconnect or on a periodic schedule.
 *
 * @param executor - Function that executes a single mutation (e.g., calls
 *   supabase or a REST API).
 */
export interface FlushResult {
  executed: number;
  failed: number;
  dropped: number;
}

export async function flushQueue(
  executor: (p: MutationPayload) => Promise<void>
): Promise<FlushResult> {
  const result: FlushResult = { executed: 0, failed: 0, dropped: 0 };
  if (flushing) return result;
  flushing = true;
  try {
    const raw = await readQueue();
    if (!raw) return result;

    let queue: MutationPayload[];
    try {
      queue = JSON.parse(raw);
    } catch {
      await removeQueue();
      captureEvent('offline_queue_corrupted', { action: 'flush_queue' });
      return result;
    }

    const remaining: MutationPayload[] = [];

    for (const item of queue) {
      try {
        await executor(item);
        result.executed++;
      } catch {
        if (item.retries < 5) {
          remaining.push({ ...item, retries: item.retries + 1 });
          result.failed++;
        } else {
          result.dropped++;
          captureEvent('offline_mutation_dropped', { endpoint: item.endpoint, retries: item.retries });
        }
      }
    }

    if (result.dropped > 0 && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[offline] ${result.dropped} mutation(s) dropped after 5 retries`);
    }

    await writeQueue(JSON.stringify(remaining));
    return result;
  } finally {
    flushing = false;
  }
}

/**
 * Get the current number of queued (pending) mutations.
 * Useful for showing a sync indicator in the UI.
 */
export async function getQueueLength(): Promise<number> {
  const raw = await readQueue();
  if (!raw) return 0;
  try {
    const queue: MutationPayload[] = JSON.parse(raw);
    return queue.length;
  } catch {
    await removeQueue();
    captureEvent('offline_queue_corrupted', { action: 'get_queue_length' });
    return 0;
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Remove all cache entries older than 2× their TTL.
 * Call periodically (e.g., on app foreground) to prevent unbounded storage growth.
 */
export async function cleanupStaleCache(): Promise<number> {
  const allKeys = await AsyncStorage.getAllKeys();
  const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
  let cleaned = 0;

  for (const key of cacheKeys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const entry: CacheEntry<unknown> = JSON.parse(raw);
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttlMs * 2) {
        await AsyncStorage.removeItem(key);
        cleaned++;
      }
    } catch {
      await AsyncStorage.removeItem(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    captureEvent('cache_cleanup', { cleaned, total: cacheKeys.length });
  }
  return cleaned;
}

/** Default stale threshold: 2 hours */
export const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/** Short cache: 5 minutes (for frequently changing data) */
export const SHORT_CACHE_MS = 5 * 60 * 1000;

/** Long cache: 24 hours (for rarely changing data) */
export const LONG_CACHE_MS = 24 * 60 * 60 * 1000;
