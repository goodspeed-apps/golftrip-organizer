/**
 * GAS Template, AppStateProvider
 *
 * Subscribes to AppState / document.visibilityState once at the root and
 * exposes the current value via context. All consumers call useAppState()
 * (which delegates here), so only one native subscription exists when the
 * provider is mounted.
 *
 * Backward-compatibility: useAppStateContext() / useAppState() fall back to a
 * direct subscription when no provider is mounted, so existing code works
 * without wrapping.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isWeb } from '../lib/platform';

export const AppStateContext = createContext<AppStateStatus | null>(null);

function getWebState(): AppStateStatus {
  if (typeof document === 'undefined') return 'active';
  return document.visibilityState === 'visible' ? 'active' : 'background';
}

/** Mount once at the app root to share a single AppState subscription. */
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppStateStatus>(
    isWeb ? getWebState() : AppState.currentState,
  );

  useEffect(() => {
    if (isWeb) {
      if (typeof document === 'undefined') return;
      const handler = () => setState(getWebState());
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    }
    const sub = AppState.addEventListener('change', (next) => setState(next));
    return () => sub.remove();
  }, []);

  return (
    <AppStateContext.Provider value={state}>
      {children}
    </AppStateContext.Provider>
  );
}

/**
 * Returns app state from context when an AppStateProvider is mounted,
 * or falls back to a direct subscription otherwise.
 *
 * Hook rules: both useState/useEffect inside always run; when context is
 * non-null the direct subscription is registered with enabled=false so it
 * subscribes to nothing and the context value is returned.
 */
export function useAppStateContext(): AppStateStatus {
  const ctx = useContext(AppStateContext);

  // Direct-subscription fallback. We always call useState/useEffect
  // unconditionally, the effect simply skips attaching a listener when
  // `ctx` is non-null (provider is mounted), avoiding duplicate subscriptions.
  const [directState, setDirectState] = useState<AppStateStatus>(
    ctx !== null ? ctx : (isWeb ? getWebState() : AppState.currentState),
  );

  useEffect(() => {
    // Provider is mounted, no direct subscription needed.
    if (ctx !== null) return;

    if (isWeb) {
      if (typeof document === 'undefined') return;
      const handler = () => setDirectState(getWebState());
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    }
    const sub = AppState.addEventListener('change', (next) => setDirectState(next));
    return () => sub.remove();
  }, [ctx]);

  return ctx ?? directState;
}