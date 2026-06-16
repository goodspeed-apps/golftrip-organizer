/**
 * GAS Template, useOnForeground Hook
 *
 * Fires `callback` each time the app transitions from background or inactive
 * into the foreground (`'active'` state). Does NOT fire on first mount.
 *
 * @example
 * useOnForeground(() => refetchUser(), [refetchUser]);
 */

import { useAppStateTransition } from './_appStateTransition';

/**
 * Runs `callback` whenever the app returns to the foreground
 * (`'background' | 'inactive'` → `'active'`). Skips the initial mount.
 *
 * @param callback - Function to invoke on foreground transition.
 * @param deps - Dependency array passed to `useCallback` for the callback.
 *
 * @example
 * useOnForeground(() => refetchUser(), [refetchUser]);
 */
export function useOnForeground(callback: () => void, deps: unknown[] = []): void {
  useAppStateTransition(
    (current, prev) => current === 'active' && (prev === 'background' || prev === 'inactive'),
    callback,
    deps,
  );
}