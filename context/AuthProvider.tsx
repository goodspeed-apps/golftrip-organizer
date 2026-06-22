/**
 * GAS Template, AuthProvider
 *
 * Owns the SINGLE source of truth for authentication state. Mounts ONE
 * getSession() call, ONE onAuthStateChange subscription, ONE AppState
 * background-timeout listener, and the biometric/MFA gate state, then
 * exposes them via context.
 *
 * Previously these internals lived in the `useAuth` hook, which was called
 * independently in ~4 component trees. Each call mounted its own concurrent
 * getSession + onAuthStateChange + AppState + biometric listeners, so the
 * app ran ~4 duplicate auth pipelines and the biometricLocked / mfaRequired
 * flags computed in one tree never reached the tree that renders the app.
 *
 * Mirrors context/AppStateProvider.tsx: provider owns the subscriptions,
 * consumers read from context via the useAuth() hook.
 *
 * Dependencies: expo-local-authentication, @react-native-async-storage/async-storage,
 *               @supabase/supabase-js, lib/supabase, lib/revenuecat, lib/posthog, gas.config
 */

import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isWeb } from '@/lib/platform';
import { gasConfig } from '../gas.config';

// Conditionally import LocalAuthentication only on native (not available on web)
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
if (!isWeb) {
  try {
    LocalAuthentication = require('expo-local-authentication');
  } catch {
    // Module not available
  }
}

// --- Conditional imports for RevenueCat and PostHog ---
// These are only used if the corresponding feature is enabled in gasConfig.
// The lib modules themselves guard against missing API keys (null exports),
// so it's safe to import unconditionally, the calls just no-op.
import { identifyRevenueCatUser, resetRevenueCatUser } from '@/lib/revenuecat';
import { identifyPostHogUser, resetPostHogUser, captureEvent } from '@/lib/posthog';
import { setUser as setSentryUser, clearUser as clearSentryUser, addBreadcrumb } from '@/lib/sentry';
import { getAAL } from '@/lib/mfa';
import { flushOnboardingAnswers } from '@/lib/onboarding-buffer';

// --- Config-driven constants ---
const BIOMETRIC_TIMEOUT_MS = (gasConfig.features.auth.biometric.timeoutMinutes ?? 5) * 60 * 1000;
const BIOMETRIC_PREF_KEY = `@${gasConfig.app.slug}:biometric_enabled`;
const IAP_ENABLED = gasConfig.features.inAppPurchases.enabled;
const ANALYTICS_ENABLED = gasConfig.features.analytics.enabled;

// --- Auth State Interface ---
export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  biometricLocked: boolean;
  biometricAvailable: boolean; // true if hardware + enrollment supported
  biometricEnabled: boolean;   // true if available AND user has opted in
  mfaRequired: boolean;        // true if user has MFA enrolled but hasn't verified this session
}

/**
 * The full value exposed by AuthProvider, the AuthState fields plus the
 * action callbacks. The useAuth() hook returns exactly this shape, so callers
 * keep working unchanged.
 */
export interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  unlockBiometric: () => Promise<boolean>;
  promptBiometric: () => Promise<boolean>;
  setBiometricPreference: (enabled: boolean) => Promise<void>;
  /** Re-check the AAL gate (call after completing an MFA challenge). */
  recheckMFA: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider, Mount ONCE high in the app tree (inside the other providers,
 * wrapping the app). Owns the single auth pipeline and shares it via context.
 *
 * On session acquisition (initial load or auth state change):
 * - Identifies the user with RevenueCat (if inAppPurchases enabled)
 * - Identifies the user with PostHog (if analytics enabled)
 *
 * On sign out:
 * - Resets RevenueCat and PostHog user associations
 *
 * Background timeout pattern:
 * - Records timestamp when app goes to background
 * - On return to foreground, if elapsed time exceeds BIOMETRIC_TIMEOUT_MS
 *   and biometric is enabled and user is authenticated, locks the app
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    biometricLocked: false,
    biometricAvailable: false,
    biometricEnabled: false,
    mfaRequired: false,
  });
  const backgroundedAt = useRef<number | null>(null);

  // --- Biometric hardware check ---
  const checkBiometricSupport = useCallback(async () => {
    if (isWeb || !LocalAuthentication) return false;
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hardware && enrolled;
  }, []);

  // --- Biometric prompt ---
  const promptBiometric = useCallback(async (): Promise<boolean> => {
    if (isWeb || !LocalAuthentication) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock ${gasConfig.app.name}`,
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });
      return result.success;
    } catch {
      return false;
    }
  }, []);

  // --- Unlock from biometric lock screen ---
  const unlockBiometric = useCallback(async () => {
    const success = await promptBiometric();
    if (success) setState(s => ({ ...s, biometricLocked: false }));
    return success;
  }, [promptBiometric]);

  // --- Check MFA assurance level ---
  const checkMFA = useCallback(async () => {
    const aal = await getAAL();
    if (aal && aal.currentLevel !== aal.nextLevel) {
      setState(s => ({ ...s, mfaRequired: true }));
    } else {
      setState(s => ({ ...s, mfaRequired: false }));
    }
  }, []);

  // --- Identify user with third-party services (conditional on config) ---
  // identifyRevenueCatUser, identifyPostHogUser, captureEvent are all `async`
  // and return promises. Calling them from a non-async callback without `void`
  // leaves the rejection unhandled, which surfaces in some web environments as
  // "TypeError: undefined is not a function" from a promise chain on a shim
  // that no-ops on web. `void` makes the intent explicit and silences the
  // promise tracking, while the shim's own internal try/catch still swallows
  // any real failure.
  const identifyUser = useCallback((userId: string, email?: string) => {
    if (IAP_ENABLED) {
      void identifyRevenueCatUser(userId);
    }
    if (ANALYTICS_ENABLED) {
      void identifyPostHogUser(userId, email ? { email } : undefined);
    }
    setSentryUser(userId, email);
    addBreadcrumb('auth', 'User identified', { userId });
  }, []);

  // --- Reset third-party service associations ---
  const resetServiceUsers = useCallback(() => {
    if (IAP_ENABLED) {
      void resetRevenueCatUser();
    }
    if (ANALYTICS_ENABLED) {
      void resetPostHogUser();
    }
    clearSentryUser();
    addBreadcrumb('auth', 'User signed out');
    void captureEvent('auth_state_change', { action: 'logout' });
  }, []);

  // --- Check hardware availability and user preference on mount ---
  useEffect(() => {
    (async () => {
      try {
        const available = await checkBiometricSupport();
        const prefRaw = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
        // Default: enabled if hardware available and user hasn't explicitly disabled
        const prefEnabled = prefRaw !== null ? prefRaw === 'true' : true;
        setState(s => ({
          ...s,
          biometricAvailable: available,
          biometricEnabled: available && prefEnabled,
        }));
      } catch {
        setState(s => ({ ...s, biometricAvailable: false, biometricEnabled: false }));
      }
    })();
  }, [checkBiometricSupport]);

  // --- Session initialization and auth state listener ---
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(s => ({ ...s, session, user: session?.user ?? null, loading: false }));
      if (session?.user) {
        identifyUser(session.user.id, session.user.email);
        checkMFA();
        // Persist any answers buffered during pre-auth onboarding.
        void flushOnboardingAnswers(session.user.id);
      }
    }).catch(() => {
      setState(s => ({ ...s, session: null, user: null, loading: false }));
    });

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setState(s => ({ ...s, session, user: session?.user ?? null, loading: false }));
      if (session?.user) {
        identifyUser(session.user.id, session.user.email);
        checkMFA();
        if (event !== 'TOKEN_REFRESHED') {
          captureEvent('auth_state_change', { action: event });
          // A fresh sign-in (email verify / OAuth / login) is the first moment
          // a session exists, flush onboarding answers buffered pre-auth.
          void flushOnboardingAnswers(session.user.id);
        }
        addBreadcrumb('auth', `Auth event: ${event}`);
      } else {
        // Signed out, clear the MFA gate so it can never strand the next
        // (unauthenticated) tree behind a stale challenge.
        setState(s => ({ ...s, mfaRequired: false, biometricLocked: false }));
        resetServiceUsers();
      }
    });

    return () => subscription.unsubscribe();
  }, [identifyUser, resetServiceUsers, checkMFA]);

  // --- Refs to track latest values without causing effect re-registration ---
  const biometricEnabledRef = useRef(state.biometricEnabled);
  const sessionRef = useRef(state.session);
  useEffect(() => {
    biometricEnabledRef.current = state.biometricEnabled;
  }, [state.biometricEnabled]);
  useEffect(() => {
    sessionRef.current = state.session;
  }, [state.session]);

  // --- Background timeout listener ---
  // Records when app goes to background; on return, if elapsed time exceeds
  // the configured timeout and biometric is enabled, triggers the lock screen.
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active') {
        // Refresh session token on foreground to prevent stale JWT
        if (sessionRef.current) {
          supabase.auth.getSession().catch(() => {});
        }

        // Capture and clear ref atomically (before any await) to prevent
        // duplicate lock triggers from rapid background/foreground transitions.
        const bgTime = backgroundedAt.current;
        backgroundedAt.current = null;
        const elapsed = bgTime ? Date.now() - bgTime : 0;
        if (elapsed >= BIOMETRIC_TIMEOUT_MS && biometricEnabledRef.current && sessionRef.current) {
          const supported = await checkBiometricSupport();
          if (supported) setState(s => ({ ...s, biometricLocked: true }));
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [checkBiometricSupport]);

  // --- Persist biometric preference ---
  const setBiometricPreference = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, String(enabled));
    setState(s => ({ ...s, biometricEnabled: s.biometricAvailable && enabled }));
  }, []);

  // --- Sign out ---
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    ...state,
    signOut,
    unlockBiometric,
    promptBiometric,
    setBiometricPreference,
    recheckMFA: checkMFA,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
