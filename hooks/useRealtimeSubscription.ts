/**
 * GAS Template, useRealtimeSubscription Hook
 *
 * Supabase Realtime subscription with auto-subscribe/unsubscribe.
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { captureException } from '../lib/sentry';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeOptions {
  event?: RealtimeEvent;
  schema?: string;
}

export function useRealtimeSubscription<T extends Record<string, unknown>>(
  table: string,
  filter?: string,
  options?: RealtimeOptions,
) {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const event = options?.event ?? '*';
    const schema = options?.schema ?? 'public';
    const channelName = `realtime:${table}:${filter ?? 'all'}`;

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel.on(
      'postgres_changes' as any,
      { event, schema, table, filter } as any,
      (payload: any) => {
        const record = (payload.new ?? payload.old) as T;
        if (!record) return;

        if (payload.eventType === 'INSERT') {
          setData(prev => [record, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setData(prev => prev.map(item =>
            (item as any).id === (record as any).id ? record : item
          ));
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as T;
          setData(prev => prev.filter(item => (item as any).id !== (old as any).id));
        }
      },
    );

    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') setStatus('connected');
      else if (s === 'CHANNEL_ERROR') {
        setStatus('error');
        setError('Subscription failed');
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [table, filter, options?.event, options?.schema]);

  return { data, error, status };
}
