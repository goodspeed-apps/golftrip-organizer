/**
 * GAS Template, useAppState Hook
 *
 * Returns the current app state as `'active' | 'background' | 'inactive'`.
 *
 * When an AppStateProvider is mounted higher in the tree, this hook reads the
 * shared context value (zero extra subscriptions per consumer). Without a
 * provider it falls back to a direct AppState / visibilitychange subscription
 * via the logic inside AppStateProvider's useAppStateContext.
 *
 * - Native: driven by React Native's `AppState` API.
 * - Web: driven by `document.visibilityState` (`'visible'` → `'active'`,
 *   `'hidden'` → `'background'`). Web never emits `'inactive'`.
 *
 * @example
 * function MyComponent() {
 *   const state = useAppState();
 *   return <Text>{state}</Text>;
 * }
 */

import { type AppStateStatus } from 'react-native';
import { useAppStateContext } from '../context/AppStateProvider';

/**
 * Unified app-state hook. Reads from AppStateProvider context when mounted;
 * installs its own direct subscription otherwise.
 */
export function useAppState(): AppStateStatus {
  return useAppStateContext();
}