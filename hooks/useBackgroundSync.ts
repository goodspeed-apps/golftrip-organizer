import { useEffect, useState, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { gasConfig } from '../gas.config';
import { queueMutation, flushQueue } from '../lib/offline';

export interface BackgroundSyncOpts<T> {
  query: () => Promise<T>;
  mutate?: (input: T) => Promise<unknown>;
  interval?: number;
  onConflict?: (local: T, remote: T) => T;
  enabled?: boolean;
  /** Stable key for deduping intervals across mounts of the same sync target. */
  syncKey?: string;
}

// Each shared interval owns a Set of subscriber sync handlers. When a
// subscriber unmounts we drop just its handler; the interval keeps firing
// for the remaining subscribers. This avoids the closure-staleness bug where
// the original mounter's `sync` was the only callback for the lifetime of
// the interval, even after it unmounted.
interface SharedSync {
  handlers: Set<() => void>;
  intervalId: ReturnType<typeof setInterval> | null;
  unsub: (() => void) | null;
}
const sharedSyncs = new Map<string, SharedSync>();

export function useBackgroundSync<T>(opts: BackgroundSyncOpts<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [syncing, setSyncing] = useState(false);
  const interval = opts.interval ?? gasConfig.growth.defaultBackgroundSyncInterval ?? 60_000;
  const enabled = opts.enabled !== false;
  const localRef = useRef<T | null>(null);
  // Ref the callbacks so the interval closure always sees the latest props.
  const handlerRef = useRef(opts);
  handlerRef.current = opts;

  const sync = async () => {
    if (!enabled) return;
    setSyncing(true);
    try {
      const o = handlerRef.current;
      const remote = await o.query();
      if (localRef.current && o.onConflict) {
        const resolved = o.onConflict(localRef.current, remote);
        setData(resolved);
        localRef.current = resolved;
      } else {
        setData(remote);
        localRef.current = remote;
      }
      // Drain any queued mutations now that we're back online.
      if (o.mutate) {
        try {
          await flushQueue(async (payload) => {
            await o.mutate!(payload.body as T);
          });
        } catch {
          // flushQueue failures are non-fatal here; queue retries on next tick
        }
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSyncing(false);
    }
  };

  // Stable ref to this subscriber's sync function so we can register and
  // unregister exactly the same handler in the shared Set.
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const stableHandler = useRef<() => void>(() => syncRef.current());

  useEffect(() => {
    if (!enabled) return;
    sync();

    // Share one interval across components with the same syncKey.
    const key = opts.syncKey;
    if (key) {
      let entry = sharedSyncs.get(key);
      if (!entry) {
        entry = { handlers: new Set(), intervalId: null, unsub: null };
        sharedSyncs.set(key, entry);
      }
      entry.handlers.add(stableHandler.current);
      if (!entry.intervalId) {
        const fanout = () => {
          const e = sharedSyncs.get(key);
          if (!e) return;
          for (const h of e.handlers) h();
        };
        entry.intervalId = setInterval(fanout, interval);
        const sub = NetInfo.addEventListener(state => {
          if (state.isConnected) fanout();
        });
        entry.unsub = sub;
      }
      return () => {
        const e = sharedSyncs.get(key);
        if (!e) return;
        e.handlers.delete(stableHandler.current);
        if (e.handlers.size === 0) {
          if (e.intervalId) clearInterval(e.intervalId);
          if (e.unsub) e.unsub();
          sharedSyncs.delete(key);
        }
      };
    }

    const id = setInterval(sync, interval);
    const unsub = NetInfo.addEventListener(state => {
      if (state.isConnected) sync();
    });
    return () => { clearInterval(id); unsub(); };
  }, [interval, enabled, opts.syncKey]);

  // Route writes through queueMutation when offline. The queue is drained on
  // the next sync() that succeeds against a connected network.
  const enqueueLocal = async (next: T) => {
    localRef.current = next;
    setData(next);
    const state = await NetInfo.fetch();
    if (!state.isConnected && handlerRef.current.mutate) {
      await queueMutation({
        id: `bgsync:${opts.syncKey ?? 'unkeyed'}:${Date.now()}`,
        endpoint: opts.syncKey ?? 'background-sync',
        method: 'POST',
        body: next as unknown as Record<string, unknown>,
      });
    }
  };

  return { data, error, syncing, sync, setLocal: enqueueLocal };
}
