/**
 * GAS Template, internal hook: useAppStateTransition
 *
 * Shared implementation powering useOnForeground and useOnBackground.
 * Fires `callback` when the predicate returns true for the current→previous
 * state transition. Does NOT fire on first mount.
 *
 * @param predicate - (current, prev) => boolean
 * @param callback  - Function to invoke on matching transition.
 * @param deps      - Dependency array for useCallback stabilisation.
 */

import { useEffect, useRef, useCallback } from 'react';
import { type AppStateStatus } from 'react-native';
import { useAppState } from './useAppState';

export function useAppStateTransition(
  predicate: (current: AppStateStatus, prev: AppStateStatus) => boolean,
  callback: () => void,
  deps: unknown[] = [],
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCallback = useCallback(callback, deps);
  const callbackRef = useRef(stableCallback);
  callbackRef.current = stableCallback;

  // Stabilise predicate in a ref so stale-closure bugs are impossible even
  // when the caller passes a dynamic (non-memoised) predicate (I5).
  const predicateRef = useRef(predicate);
  predicateRef.current = predicate;

  const appState = useAppState();
  const prevStateRef = useRef(appState);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevStateRef.current = appState;
      return;
    }

    const prev = prevStateRef.current;
    prevStateRef.current = appState;

    if (predicateRef.current(appState, prev)) {
      callbackRef.current();
    }
  }, [appState]); // eslint-disable-line react-hooks/exhaustive-deps
}