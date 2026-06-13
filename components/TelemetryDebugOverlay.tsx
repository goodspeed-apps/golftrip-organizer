import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTelemetry } from '../context/TelemetryProvider';
import { gasConfig } from '../gas.config';
import { useThemeColors } from '@/context/ThemeContext';

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
  const { colors } = useThemeColors();

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
        // swallow, overlay is best-effort
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

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 90,
      right: 12,
      backgroundColor: colors.overlay,
      borderRadius: 10,
      padding: 10,
      maxWidth: 320,
      zIndex: 9999,
    },
    expanded: {
      maxHeight: 300,
    },
    label: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 2,
    },
    value: {
      color: colors.textOnPrimary,
      fontSize: 11,
      fontFamily: 'monospace',
    },
    list: {
      marginTop: 6,
    },
    empty: {
      color: colors.border,
      fontSize: 11,
      fontStyle: 'italic',
    },
    item: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: 'monospace',
      marginBottom: 2,
    },
  });

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
                {e.timestamp.slice(11, 19)} {e.type}{e.screen ? ` (${e.screen})` : ''}
              </Text>
            ))
          )}
        </ScrollView>
      )}
    </Pressable>
  );
}
