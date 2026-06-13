/**
 * GAS Template, useOfflineSync Hook
 *
 * NetInfo-aware offline queue management with automatic flush on reconnect.
 *
 * Features:
 * - Monitors network connectivity via @react-native-community/netinfo
 * - Tracks online/offline state for UI display (e.g., offline banner)
 * - Automatically flushes the offline mutation queue when connectivity is restored
 * - Uses the proven wasOffline ref pattern to avoid redundant flushes
 * - Delegates to lib/offline's flushQueue with a default Supabase executor
 *
 * The offline queue (lib/offline) stores mutations as {endpoint, method, body} payloads.
 * When the device goes offline, mutations are queued. When it comes back online,
 * this hook triggers the flush, which retries each queued mutation (up to 5 retries).
 *
 * Extracted from ThreadLift, made generic.
 *
 * Dependencies: @react-native-community/netinfo, lib/offline, lib/supabase
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { flushQueue, getQueueLength, type MutationPayload } from '@/lib/offline';
import { captureEvent } from '@/lib/posthog';
import { addBreadcrumb } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { isWeb } from '@/lib/platform';

/**
 * Default executor for queued mutations.
 *
 * Invokes a Supabase Edge Function with the specified endpoint, method, and body.
 * This is the standard execution path for offline-queued operations.
 *
 * You can override this by passing a custom executor to flushQueue directly,
 * or by modifying this function to route to different backends.
 */
async function defaultExecutor(payload: MutationPayload): Promise<void> {
  const { endpoint, method, body } = payload;
  const { error } = await supabase.functions.invoke(endpoint, { method, body });
  if (error) throw error;
}

/**
 * useOfflineSync, Network-aware offline queue hook.
 *
 * @returns {Object}
 *   - isOnline: boolean, current network connectivity state
 *   - flushQueue: () => Promise<void>, manually trigger queue flush
 *
 * The hook automatically flushes the queue when transitioning from offline to online.
 * You can also call flushQueue manually (e.g., on pull-to-refresh).
 *
 * Usage:
 *   const { isOnline, flushQueue } = useOfflineSync();
 *
 *   // Show offline banner:
 *   {!isOnline && <OfflineBanner />}
 *
 *   // Manual flush on pull-to-refresh:
 *   const onRefresh = async () => { await flushQueue(); };
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const wasOffline = useRef(false);
  const isMounted = useRef(true);

  // Memoized flush function using the default Supabase executor
  const flush = useCallback(async () => {
    await flushQueue(defaultExecutor);
  }, []);

  useEffect(() => {
    isMounted.current = true;

    // NetInfo is not available on web, skip listener entirely
    if (isWeb) return;

    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      if (!isMounted.current) return;

      // Consider online only if connected AND internet is reachable (not false).
      // isInternetReachable can be null (unknown), treat as online in that case.
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);

      if (online && wasOffline.current) {
        // Transitioning from offline to online, flush the queue
        wasOffline.current = false;
        getQueueLength().then(queueSize => {
          if (!isMounted.current) return;
          captureEvent('online_restored', { queueSize });
          addBreadcrumb('network', 'Online restored', { queueSize: String(queueSize) });
        }).catch(() => {});
        flush();
      } else if (!online) {
        // Record that we went offline so we know to flush on reconnect
        wasOffline.current = true;
        captureEvent('offline_detected');
        addBreadcrumb('network', 'Device went offline');
      }
    });

    return () => {
      isMounted.current = false;
      unsub();
    };
  }, [flush]);

  return { isOnline, flushQueue: flush };
}
