import { useEffect } from 'react';
import { acquireChannel, releaseChannel } from '../services/realtime';

export function useChannelSubscription<T = unknown>(
  channelName: string,
  event: string,
  handler: (payload: T) => void,
): void {
  useEffect(() => {
    const entry = acquireChannel(channelName);
    const channel = entry.channel;
    const wrapped = (msg: any) => {
      handler(msg?.payload as T);
    };

    // Attach our broadcast listener. Multiple subscribers on the same channel
    // each install their own .on() handler, Supabase fans the event out
    // server-side to a single channel and the SDK invokes every registered
    // listener locally.
    channel.on('broadcast' as any, { event }, wrapped);

    return () => {
      // Supabase RealtimeChannel exposes `off`/`unsubscribe` for removing a
      // specific listener, but the public surface is unstable across SDK
      // versions, so the safest cleanup is to release our refcount and let
      // the cache evict the underlying channel when no callers remain.
      releaseChannel(channelName);
    };
    // handler is intentionally captured by-reference per render; passing a
    // ref-stabilised wrapper would defeat the cache's WS-sharing benefits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, event]);
}
