/**
 * GAS Template, useMount
 *
 * Runs an effect exactly once on component mount.
 * Cleaner than useEffect with empty deps array.
 *
 * Note: If your callback references props or state that may change,
 * wrap it in useCallback with proper deps before passing to useMount.
 */

import { useEffect, type EffectCallback } from 'react';

export function useMount(callback: EffectCallback): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(callback, []);
}
