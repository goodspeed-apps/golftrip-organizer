/**
 * GAS Template, usePresence Hook
 *
 * Wraps Supabase Realtime presence channels. Tracks the caller's payload
 * and emits the live peer list.
 *
 * Routes through the shared services/realtime channel cache so the
 * underlying WS is reused across hooks. Presence channels require a
 * distinct `config.presence.key`, so they live in a separate cache namespace
 * (see presenceCacheKey()), a presence channel can't collide with a
 * same-named broadcast channel.
 */

import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import {
  acquireChannel,
  presenceCacheKey,
  releaseChannel,
  type PresencePeer,
  type UsePresenceReturn,
} from '../services/realtime';

export function usePresence(
  channelName: string,
  payload: Record<string, unknown>,
): UsePresenceReturn {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [status, setStatus] = useState<UsePresenceReturn['status']>('joining');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const presenceKey = (payload.user_id as string | undefined) ?? Crypto.randomUUID();
    const cacheKey = presenceCacheKey(channelName, presenceKey);

    const entry = acquireChannel(channelName, {
      cacheKey,
      createChannel: () =>
        supabase.channel(channelName, {
          config: { presence: { key: presenceKey } },
        }),
    });
    const channel = entry.channel;
    channelRef.current = channel;

    const syncPeers = () => {
      const state = channel.presenceState<Record<string, unknown>>();
      const flat: PresencePeer[] = Object.values(state).flatMap(
        (arr) => arr as PresencePeer[],
      );
      setPeers(flat);
    };

    channel
      .on('presence' as any, { event: 'sync' }, syncPeers)
      .on('presence' as any, { event: 'join' }, syncPeers)
      .on('presence' as any, { event: 'leave' }, syncPeers);

    // Wait for the cache's subscribe promise to settle, then track our
    // payload. If the underlying channel was already SUBSCRIBED (cache hit),
    // the promise resolves synchronously on the microtask queue.
    let cancelled = false;
    entry.subscribed
      .then(() => {
        if (cancelled) return;
        setStatus('joined');
        channel.track(payload);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });

    return () => {
      cancelled = true;
      channel.untrack();
      releaseChannel(channelName, cacheKey);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  return { peers, status };
}
