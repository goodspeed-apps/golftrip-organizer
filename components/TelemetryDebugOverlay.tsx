import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTelemetry } from '../context/TelemetryProvider';
import { gasConfig } from '../gas.config';

interface RecentEvent {
  type: string;
  screen?: string;
  timestamp: string;
}

interface OverlayState {
  eventCount: number;
  queueSize: number;
  lastFlushAt: string | null;
  lastStatus: string | null;
  consent: 'on' | 'off' | 'unknown';
  recent: RecentEvent[];
}

export function TelemetryDebugOverlay() {
  const enabled =
    (typeof __DEV__ !== 'undefined' && __DEV__) ||
    gasConfig.features.telemetry?.debugOverlay === true;

  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<OverlayState>({
    eventCount: 0,
    queueSize: 0,
    lastFlushAt: null,
    lastStatus: null,
    consent: 'unknown',
    recent: [],
  });

  const client = useTelemetry();

  // Poll AsyncStorage for queue size and consent every 2s.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const interval = setInterval(async () => {
      if (!alive) return;
      try {
        const queueRaw = await AsyncStorage.getItem('@goodspeed:telemetry:queue');
        const queue: unknown[] = queueRaw ? (JSON.parse(queueRaw) as unknown[]) : [];
        const consentRaw = await AsyncStorage.getItem(`@${gasConfig.app.slug}:consent`);
        const consent: OverlayState['consent'] =
          consentRaw === null ? 'on' : consentRaw === 'granted' ? 'on' : 'off';
        setState(s => ({
          ...s,
          queueSize: Array.isArray(queue) ? queue.length : 0,
          consent,
        }));
      } catch {
        // swallow — overlay is best-effort
      }
    }, 2000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [enabled]);

  // Monkey-patch client.track / client.flush to capture event counts.
  // Only active in dev; restored on cleanup so underlying behaviour is unchanged.
  useEffect(() => {
    if (!enabled || !client) return;

const clientAny = client as unknown as Record<string, unknown>;
    const originalTrack = client.track.bind(client);
    clientAny.track = (event: Record<string, unknown>) => {
      setState(s => ({
        ...s,
        eventCount: s.eventCount + 1,
        recent: [
          {
            type: typeof event.eventType === 'string' ? event.eventType : 'unknown',
            screen: typeof event.screenName === 'string' ? event.screenName : undefined,
            timestamp: new Date().toISOString(),
          },
          ...s.recent,
        ].slice(0, 10),
      }));
      return originalTrack(event as Parameters<typeof originalTrack>[0]);
    };

    const originalFlush = client.flush.bind(client);
    clientAny.flush = async () => {
      const result = await originalFlush();
      setState(s => ({
        ...s,
        lastFlushAt: new Date().toISOString(),
        lastStatus: '200',
      }));
      return result;
    };

    return () => {
      clientAny.track = originalTrack;
      clientAny.flush = originalFlush;
    };
  }, [client, enabled]);

  if (!enabled) return null;

  return (
    <Pressable
      style={[styles.container, expanded && styles.expanded]}
      onPress={() => setExpanded(e => !e)}
    >
      <Text style={styles.label}>Telemetry</Text>
      <Text style={styles.value}>
        events: {state.eventCount} · queue: {state.queueSize} · {state.consent}
      </Text>
      {state.lastFlushAt != null && (
        <Text style={styles.value}>
          last: {state.lastFlushAt.slice(11, 19)} ({state.lastStatus ?? '?'})
        </Text>
      )}
      {expanded && (
        <ScrollView style={styles.list}>
          {state.recent.length === 0 ? (
            <Text style={styles.empty}>(no events yet)</Text>
          ) : (
            state.recent.map((e, i) => (
              <Text key={i} style={styles.item}>
                {e.timestamp.slice(11, 19)} {e.type}
                {e.screen != null ? ` ${e.screen}` : ''}
              </Text>
            ))
          )}
        </ScrollView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    padding: 8,
    minWidth: 160,
    maxWidth: 240,
    zIndex: 9999,
  },
  expanded: {
    maxHeight: 280,
  },
  label: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '600',
  },
  value: {
    color: '#fff',
    fontSize: 11,
  },
  list: {
    marginTop: 6,
    maxHeight: 200,
  },
  item: {
    color: '#d1d5db',
    fontSize: 10,
    lineHeight: 14,
  },
  empty: {
    color: '#6b7280',
    fontSize: 10,
    fontStyle: 'italic',
  },
});