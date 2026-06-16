/**
 * GAS Template, useAuth Hook
 *
 * Reads the shared authentication state from AuthProvider (context/AuthProvider.tsx).
 *
 * This hook USED to own all of the auth internals itself, getSession,
 * onAuthStateChange, the AppState background-timeout listener, biometric state,
 * and the MFA gate. Because it was called independently in ~4 component trees,
 * every app mounted ~4 concurrent copies of those subscriptions, and the
 * biometricLocked / mfaRequired flags computed in one tree never reached the
 * tree that renders the app (so the security features were effectively no-ops).
 *
 * Those internals now live in a single <AuthProvider> mounted once at the root.
 * useAuth() simply reads that context, so every call site shares ONE source of
 * truth and ONE set of subscriptions. The returned shape is unchanged (plus a
 * new `recheckMFA` action used by the MFA challenge screen), so existing
 * callers (settings, index, _layout) keep working without edits.
 *
 * Dependencies: context/AuthProvider
 */

import { useContext } from 'react';
import { AuthContext, type AuthContextValue, type AuthState } from '@/context/AuthProvider';

// Re-export the state interface so existing imports of `AuthState` from this
// module keep resolving.
export type { AuthState, AuthContextValue };

/**
 * useAuth, Access the shared authentication state and actions.
 *
 * Returns session, user, loading state, biometric lock / MFA gate flags, and
 * actions for sign out, biometric unlock, biometric preference toggling, and
 * re-checking the MFA assurance level.
 *
 * Must be called within an <AuthProvider> (mounted at the app root in
 * app/_layout.tsx).
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider> (mounted in app/_layout.tsx).');
  }
  return ctx;
}
