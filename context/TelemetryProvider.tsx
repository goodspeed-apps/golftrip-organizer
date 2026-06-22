/**
 * GAS Template, TelemetryProvider
 *
 * Mounts the inlined telemetry client (lib/telemetry). Gated by:
 * 1. gasConfig.features.telemetry.enabled
 * 2. checkAnalyticsConsent(), default ON (opt-out posture)
 *
 * Tracks:
 * - session_start on app boot
 * - session_end on AppState → 'background'
 * - screen_view on every Expo Router pathname change
 *
 * Device ID is persisted in AsyncStorage at @{slug}:telemetry:device_id.
 *
 * When the user turns off consent via ConsentBanner, the client is stopped.
 * Subscribe via addConsentListener / removeConsentListener from lib/posthog
 * is not available, instead the provider listens to AppState and re-checks
 * consent on foreground so revoked consent is honoured within one app cycle.
 */

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSegments, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelemetryClient, type TelemetryEvent } from '../lib/telemetry';
import { gasConfig } from '../gas.config';
import { checkAnalyticsConsent } from '../lib/posthog';

const DEVICE_ID_KEY = `@${gasConfig.app.slug}:telemetry:device_id`;

const TelemetryContext = createContext<TelemetryClient | null>(null);

export function useTelemetry(): TelemetryClient | null {
  return useContext(TelemetryContext);
}

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const cached = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (cached) return cached;
    const id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  }
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<TelemetryClient | null>(null);
  const sessionIdRef = useRef<string>(`sess_${Date.now().toString(36)}`);
  const deviceIdRef = useRef<string>('');
  const startedRef = useRef(false);
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    let mounted = true;

    async function init() {
      const telemetryConfig = gasConfig.features.telemetry;
      if (!telemetryConfig?.enabled) return;

      const consent = await checkAnalyticsConsent();
      if (!consent || !mounted) return;

      const deviceId = await getOrCreateDeviceId();
      if (!mounted) return;

      deviceIdRef.current = deviceId;

      clientRef.current = new TelemetryClient({
        appId: gasConfig.app.slug,
        category: (gasConfig.app as unknown as Record<string, unknown>).category as string ?? 'productivity',
        ingestUrl: telemetryConfig.ingestUrl,
        ingestSecret: gasConfig.backend.telemetry.ingestSecret,
        flushIntervalMs: telemetryConfig.flushIntervalMs,
        maxQueueSize: telemetryConfig.maxQueueSize,
      });

      await clientRef.current.start();
      startedRef.current = true;

      clientRef.current.track({
        deviceId,
        sessionId: sessionIdRef.current,
        eventType: 'session_start',
        payload: {},
      } as Omit<TelemetryEvent, 'appId' | 'category' | 'timestamp'>);
    }

    void init();

    // Re-check consent on foreground resume, handles the case where the user
    // revoked consent in Settings and then backgrounds + reopens the app.
    const handleAppState = async (next: AppStateStatus) => {
      if (next === 'background' && clientRef.current) {
        clientRef.current.track({
          deviceId: deviceIdRef.current,
          sessionId: sessionIdRef.current,
          eventType: 'session_end',
          payload: {},
        } as Omit<TelemetryEvent, 'appId' | 'category' | 'timestamp'>);
        void clientRef.current.flush();
      }

      if (next === 'active' && startedRef.current) {
        const consent = await checkAnalyticsConsent();
        if (!consent && clientRef.current) {
          clientRef.current.stop();
          clientRef.current = null;
          startedRef.current = false;
        }
      }
    };

    const sub = AppState.addEventListener('change', (s) => { void handleAppState(s); });

    return () => {
      mounted = false;
      sub.remove();
      clientRef.current?.stop();
    };
  }, []);

  // Track screen views on every pathname change.
  useEffect(() => {
    if (!clientRef.current) return;
    clientRef.current.track({
      deviceId: deviceIdRef.current,
      sessionId: sessionIdRef.current,
      eventType: 'screen_view',
      screenName: pathname,
      screenKind: segments[0] ?? 'root',
      payload: {},
    } as Omit<TelemetryEvent, 'appId' | 'category' | 'timestamp'>);
  }, [pathname, segments]);

  return (
    <TelemetryContext.Provider value={clientRef.current}>
      {children}
    </TelemetryContext.Provider>
  );
}