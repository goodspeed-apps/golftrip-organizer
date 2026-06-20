/**
 * GAS Template, useTimeout Hook
 *
 * setTimeout with auto-cleanup, reset, and clear. Pass null to disable.
 */

import { useEffect, useRef, useCallback } from 'react';

export function useTimeout(callback: () => void, delayMs: number | null) {
  const fnRef = useRef(callback);
  fnRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    clear();
    if (delayMs !== null) {
      timerRef.current = setTimeout(() => fnRef.current(), delayMs);
    }
  }, [delayMs, clear]);

  useEffect(() => {
    reset();
    return clear;
  }, [delayMs]);

  return { reset, clear };
}
