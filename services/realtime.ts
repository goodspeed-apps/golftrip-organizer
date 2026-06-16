/**
 * GAS Template, Realtime Service
 *
 * One-shot server-fanout helper (`broadcast`). The presence and broadcast
 * subscription hooks live in:
 *   - hooks/usePresence.ts
 *   - hooks/useChannelSubscription.ts
 *
 * All three pathways share a module-level channel cache keyed by channel
 * name (broadcast/subscription) or `${channelName}:presence:${key}` (presence,
 * since presence channels need a distinct `config.presence.key`). The cache
 * refcounts callers so repeated acquires re-use one underlying WS connection,
 * applies an idle TTL after the last release, evicts LRU entries above
 * MAX_CACHE_SIZE, and exposes a NODE_ENV==='test' clear helper.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { gasConfig } from '../gas.config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresencePeer {
  presence_ref: string;
  [key: string]: unknown;
}

export interface UsePresenceReturn {
  peers: PresencePeer[];
  status: 'joining' | 'joined' | 'error' | 'closed';
}

// ─── Channel cache ────────────────────────────────────────────────────────────

interface CachedChannel {
  channel: RealtimeChannel;
  subscribed: Promise<void>;
  refs: number;
  lastUsedAt: number;
  idleTimer?: ReturnType<typeof setTimeout>;
}

const CHANNEL_IDLE_TTL_MS = 60_000;
const MAX_CACHE_SIZE = 32;
const channelCache = new Map<string, CachedChannel>();

/**
 * Compose a presence cache key so a presence-keyed channel cannot collide
 * with a same-named broadcast channel.
 */
export function presenceCacheKey(channelName: string, presenceKey: string): string {
  return `${channelName}:presence:${presenceKey}`;
}

interface AcquireOptions {
  /** Cache key (defaults to channelName). Use presenceCacheKey() for presence. */
  cacheKey?: string;
  /** Subscribe timeout in ms. Defaults to BROADCAST_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Factory called only on cache miss. Defaults to supabase.channel(name). */
  createChannel?: () => RealtimeChannel;
}

/**
 * Acquire a refcounted handle on a cached realtime channel. The caller MUST
 * pair every acquire with a release of the same key.
 */
export function acquireChannel(channelName: string, options: AcquireOptions = {}): CachedChannel {
  const cacheKey = options.cacheKey ?? channelName;
  const timeoutMs = options.timeoutMs ?? BROADCAST_TIMEOUT_MS;

  const existing = channelCache.get(cacheKey);
  if (existing) {
    if (existing.idleTimer) {
      clearTimeout(existing.idleTimer);
      existing.idleTimer = undefined;
    }
    existing.refs += 1;
    existing.lastUsedAt = Date.now();
    return existing;
  }

  // Evict the LRU idle (refs===0) entry if we're at capacity.
  if (channelCache.size >= MAX_CACHE_SIZE) {
    evictLruIdle();
  }

  const channel = options.createChannel ? options.createChannel() : supabase.channel(channelName);
  const subscribed = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`broadcast subscribe timeout on channel "${channelName}"`));
    }, timeoutMs);
    channel.subscribe((s: string) => {
      if (s === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        clearTimeout(timer);
        reject(new Error(`broadcast channel status: ${s}`));
      }
    });
  });

  const entry: CachedChannel = { channel, subscribed, refs: 1, lastUsedAt: Date.now() };
  channelCache.set(cacheKey, entry);
  return entry;
}

export function releaseChannel(channelName: string, cacheKey?: string): void {
  const key = cacheKey ?? channelName;
  const entry = channelCache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  entry.lastUsedAt = Date.now();
  if (entry.refs <= 0) {
    entry.idleTimer = setTimeout(() => {
      const current = channelCache.get(key);
      if (current && current.refs <= 0) {
        supabase.removeChannel(current.channel);
        channelCache.delete(key);
      }
    }, CHANNEL_IDLE_TTL_MS);
  }
}

function evictLruIdle(): void {
  let oldestKey: string | undefined;
  let oldestAt = Infinity;
  for (const [key, entry] of channelCache.entries()) {
    if (entry.refs <= 0 && entry.lastUsedAt < oldestAt) {
      oldestAt = entry.lastUsedAt;
      oldestKey = key;
    }
  }
  if (oldestKey !== undefined) {
    const victim = channelCache.get(oldestKey)!;
    if (victim.idleTimer) clearTimeout(victim.idleTimer);
    supabase.removeChannel(victim.channel);
    channelCache.delete(oldestKey);
  }
  // If every entry is in-flight (refs > 0), we simply allow the cache to grow.
  // That's preferable to evicting a live subscriber.
}

/**
 * Test-only escape hatch: cancels every idle timer and empties the cache.
 * Gated on NODE_ENV==='test' so production callers can't accidentally use it.
 */
export function __clearChannelCache(): void {
  if (process.env.NODE_ENV !== 'test') return;
  for (const [name, entry] of channelCache.entries()) {
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    supabase.removeChannel(entry.channel);
    channelCache.delete(name);
  }
}

/** @deprecated kept as an alias for back-compat with existing tests. */
export const __clearBroadcastChannelCache = __clearChannelCache;

// ─── broadcast ────────────────────────────────────────────────────────────────

const BROADCAST_TIMEOUT_MS = 5_000;

export async function broadcast(
  channelName: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  const timeoutMs = gasConfig.realtime?.presenceTimeoutMs ?? BROADCAST_TIMEOUT_MS;

  return new Promise<{ ok: boolean }>((resolve, reject) => {
    const entry = acquireChannel(channelName, { timeoutMs });

    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      releaseChannel(channelName);
    };

    const timer = setTimeout(() => {
      releaseOnce();
      reject(new Error(`broadcast timeout on channel "${channelName}"`));
    }, timeoutMs);

    entry.subscribed
      .then(async () => {
        if (released) return;
        try {
          const result = await entry.channel.send({
            type: 'broadcast',
            event,
            payload,
          });
          if (released) return;
          clearTimeout(timer);
          releaseOnce();
          if ((result as string) === 'ok' || (result as string) === 'rate limited') {
            resolve({ ok: true });
          } else {
            reject(new Error(`broadcast failed: ${result}`));
          }
        } catch (err) {
          if (released) return;
          clearTimeout(timer);
          releaseOnce();
          reject(err);
        }
      })
      .catch((err) => {
        if (released) {
          // Timeout already won; nothing to do.
          return;
        }
        clearTimeout(timer);
        // Evict the failed entry so the next caller starts a fresh subscribe.
        const current = channelCache.get(channelName);
        if (current === entry) {
          released = true;
          if (entry.idleTimer) clearTimeout(entry.idleTimer);
          supabase.removeChannel(entry.channel);
          channelCache.delete(channelName);
        } else {
          releaseOnce();
        }
        reject(err);
      });
  });
}
