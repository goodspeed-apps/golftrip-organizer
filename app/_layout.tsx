/**
 * GAS Template, Root Layout
 *
 * Based on ThreadLift's _layout.tsx, made config-driven via gasConfig.
 *
 * - SafeAreaProvider wraps everything (CRITICAL for Dynamic Island / notch)
 * - ThemeProvider always included
 * - HelpProvider conditional on gasConfig.features.helpSystem
 * - RevenueCat init conditional on gasConfig.features.inAppPurchases.enabled
 * - OTA update check (expo-updates)
 * - Auth routing: session -> /(tabs), no session -> /(auth)
 * - StatusBar with theme-aware style
 */

import '../global.css';
import React, { useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Slot, useRouter, useSegments, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useAuth } from '../hooks/useAuth';
import { ThemeProvider, useThemeColors } from '../context/ThemeContext';
import { captureEvent, onConsentChanged } from '../lib/posthog';
import { initSentry, SentryErrorBoundary, addBreadcrumb } from '../lib/sentry';
import { trackAppStartup } from '../lib/performance';
import { guardLaunch, markLaunchHealthy } from '../lib/app-update';
import { useNPSSurvey, NPSSurvey } from '../components/NPSSurvey';
import { FeedbackButton } from '../components/FeedbackButton';
import { ConsentBanner, type ConsentState } from '../components/ConsentBanner';
import { ATTPrompt } from '../components/ATTPrompt';
import { ToastProvider } from '../components/Toast';
import { gasConfig } from '../gas.config';
import { BuiltWithBadge } from '../components/BuiltWithBadge';

// --- Conditional imports ---
// HelpProvider is only used if helpSystem is enabled.
// RevenueCat init is deferred until after consent state is resolved.
import { HelpProvider } from '../context/HelpContext';
import { TelemetryProvider } from '../context/TelemetryProvider';
import { TelemetryDebugOverlay } from '../components/TelemetryDebugOverlay';
import { initRevenueCat } from '../lib/revenuecat';
import { MinVersionProvider, useMinVersion } from '../context/MinVersionContext';
import { UpdateRequired } from '../components/UpdateRequired';
import { MinVersionGate } from '../components/MinVersionGate';
import { AppStateProvider } from '../context/AppStateProvider';
import { AuthProvider } from '../context/AuthProvider';
import { BiometricLockScreen } from '../components/BiometricLockScreen';
import { MfaChallenge } from '../components/MfaChallenge';

// Validate required env vars in dev
if (__DEV__) {
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    console.error('[GAS] Missing EXPO_PUBLIC_SUPABASE_URL, Supabase will not work');
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[GAS] Missing EXPO_PUBLIC_SUPABASE_ANON_KEY, Supabase will not work');
  }
}

// Record cold start time at module load
const coldStartTime = Date.now();

// Initialize Sentry at module level (before any rendering)
initSentry();

// Hold the splash screen until OTA check is complete.
SplashScreen.preventAutoHideAsync();

/**
 * Check for OTA updates and apply if available.
 * No-op in dev builds or when offline.
 */
async function applyOTAIfAvailable() {
  try {
    if (!Updates.isEnabled) return;
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Dev builds, no network, etc., show app as-is.
  }
}

// NOTE: RevenueCat is no longer initialized at module level.
// It is deferred until after consent state is resolved (see RootLayoutInner).

/**
 * Inner layout component that has access to ThemeContext.
 * Handles auth-based routing and renders the StatusBar with theme-aware style.
 *
 * Analytics (PostHog) and RevenueCat initialization are deferred until after
 * the consent state is resolved, either from a prior saved consent or after
 * the ConsentBanner is shown and the user makes a choice.
 */
function RootLayoutInner() {
  const { session, user, loading, biometricLocked, mfaRequired } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const { resolved, colors } = useThemeColors();
  const { shouldShow: showNPS, dismiss: dismissNPS } = useNPSSurvey();
  const coldStartTracked = useRef(false);
  const revenueCatInitRef = useRef(false);

  // Crash-on-launch guard → OTA update → hide splash.
  useEffect(() => {
    let healthyTimer: ReturnType<typeof setTimeout> | undefined;
    guardLaunch().then((reloadImminent) => {
      if (reloadImminent) return; // a recovery reload is happening; do nothing
      applyOTAIfAvailable().finally(() => {
        SplashScreen.hideAsync();
      });
      // Mark this launch healthy once the UI has had time to render.
      healthyTimer = setTimeout(() => { markLaunchHealthy(); }, 4000);
    });
    // Track cold start
    if (!coldStartTracked.current) {
      try {
        trackAppStartup(Date.now() - coldStartTime);
        coldStartTracked.current = true;
      } catch (e) {
        addBreadcrumb('performance', 'Failed to track cold start');
      }
    }
    // Deferred RevenueCat init, safe to init after consent since it does not
    // collect analytics data, but we defer to keep all SDK inits together.
    if (gasConfig.features.inAppPurchases.enabled && !revenueCatInitRef.current) {
      revenueCatInitRef.current = true;
      initRevenueCat().catch(() => {});
    }
    return () => { if (healthyTimer) clearTimeout(healthyTimer); };
  }, []);

  // Auto screen tracking, fires on every route change
  useEffect(() => {
    if (pathname) {
      captureEvent('$screen', { $screen_name: pathname });
      addBreadcrumb('navigation', `Screen: ${pathname}`);
    }
  }, [pathname]);

  // Auth-based routing: redirect to auth or tabs based on session state.
  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';
    const inTabs = segments[0] === '(tabs)';

    // Get the first tab's file name from config for the default authenticated route.
    const firstTab = gasConfig.navigation.tabs[0]?.file ?? 'index';

    if (!session && inTabs) {
      router.replace('/(auth)/login');
    } else if (session && inAuth) {
      router.replace(`/(tabs)/${firstTab}` as any);
    }
  }, [session, loading, segments]);

  // Consent callback, notifies PostHog analytics module when consent changes.
  // This bridges the ConsentBanner component with the lazy PostHog initialization.
  const handleConsentComplete = useCallback((consent: ConsentState) => {
    onConsentChanged(consent.analytics);
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {SentryErrorBoundary ? (
        <SentryErrorBoundary>
          <Slot />
          {/* ATT prompt (iOS only, one-time, after splash) */}
          <ATTPrompt userId={user?.id} />
          {/* NPS survey (auto-triggered after N sessions) */}
          {showNPS && <NPSSurvey visible onClose={dismissNPS} userId={user?.id} />}
          {/* GDPR/CCPA consent banner, notifies PostHog of consent changes */}
          <ConsentBanner userId={user?.id} onComplete={handleConsentComplete} />
          {gasConfig.features.showBuiltWithBadge && <BuiltWithBadge />}
        </SentryErrorBoundary>
      ) : (
        <>
          <Slot />
          <ATTPrompt userId={user?.id} />
          {showNPS && <NPSSurvey visible onClose={dismissNPS} userId={user?.id} />}
          <ConsentBanner userId={user?.id} onComplete={handleConsentComplete} />
          {gasConfig.features.showBuiltWithBadge && <BuiltWithBadge />}
        </>
      )}
      {/* Floating feedback button with shake-to-report, rendered once, outside
          the Sentry boundary branches so it is never duplicated. Gated on an
          active session so it can NEVER appear on the pre-login auth screens
          (defense in depth: even if the component drifts and loses its internal
          __DEV__ guard during generation, this mount keeps it off the login and
          signup screens). It is also __DEV__-gated inside FeedbackButton itself. */}
      {session && user && <FeedbackButton userId={user.id} />}
      {/* Security gates, full-screen absolute overlays rendered LAST so they
          cover the entire app (Slot + every floating control). Only meaningful
          for an authenticated session. MFA elevation (AAL1 -> AAL2) takes
          precedence; once cleared, a background-timeout biometric lock blocks
          until the user re-authenticates. Each dismisses only via its own
          success path (see AuthProvider). */}
      {session && user && mfaRequired && <MfaChallenge />}
      {session && user && biometricLocked && <BiometricLockScreen />}
    </>
  );
}

/**
 * Root layout, wraps the entire app with required providers.
 *
 * Provider order (outermost to innermost):
 * 1. SafeAreaProvider (CRITICAL, must be outermost for SafeAreaView to work)
 * 2. ThemeProvider (provides colors to all screens)
 * 3. HelpProvider (conditional on gasConfig.features.helpSystem)
 * 4. RootLayoutInner (auth routing + StatusBar)
 */
/**
 * Gates the rest of the app tree on the server-side min-version check.
 * Must be rendered inside ThemeProvider (UpdateRequired uses useThemeColors).
 */
function ServerMinVersionGate({ children }: { children: React.ReactNode }) {
  const { checked, mustUpdate, message } = useMinVersion();
  const platformKey = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : undefined;
  const storeUrl = platformKey ? gasConfig.releaseChannels?.storeUrl?.[platformKey] : undefined;

  // While check is pending, show nothing extra (splash is still visible or app loads normally)
  if (!checked) return <>{children}</>;
  if (mustUpdate) return <UpdateRequired message={message} storeUrl={storeUrl} />;
  return <>{children}</>;
}

export default function RootLayout() {
  const inner = gasConfig.features.helpSystem ? (
    <HelpProvider>
      <RootLayoutInner />
    </HelpProvider>
  ) : (
    <RootLayoutInner />
  );

return (
    // GestureHandlerRootView MUST be the outermost wrapper or every gesture in
    // the app (pinch-to-zoom, swipeable rows, bottom sheets) is silently dead on
    // the New Architecture. expo-router does not inject it.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AppStateProvider>
        <TelemetryProvider>
          <ThemeProvider>
  <AuthProvider>
  <MinVersionGate>
    <ToastProvider>
      <MinVersionProvider>
        <ServerMinVersionGate>
          {inner}
        </ServerMinVersionGate>
      </MinVersionProvider>
    </ToastProvider>
  </MinVersionGate>
  </AuthProvider>
</ThemeProvider>
        <TelemetryDebugOverlay />
      </TelemetryProvider>
      </AppStateProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
