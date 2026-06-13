/**
 * GAS Template, useOnBackground Hook
 *
 * Fires `callback` each time the app transitions from active to background.
 * Does NOT fire on first mount.
 *
 * @example
 * useOnBackground(() => pauseVideo(), [pauseVideo]);
 */

import { useAppStateTransition } from './_appStateTransition';

/**
 * Runs `callback` whenever the app moves to the background
 * (`'active'` → `'background'`). Skips the initial mount.
 *
 * @param callback - Function to invoke on background transition.
 * @param deps - Dependency array passed to `useCallback` for the callback.
 *
 * @example
 * useOnBackground(() => pauseVideo(), [pauseVideo]);
 */
export function useOnBackground(callback: () => void, deps: unknown[] = []): void {
  useAppStateTransition(
    (current, prev) => current === 'background' && prev === 'active',
    callback,
    deps,
  );
}