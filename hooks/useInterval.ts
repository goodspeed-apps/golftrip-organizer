/**
 * GAS Template, useInterval Hook
 *
 * setInterval with auto-cleanup. Pass null delay to pause.
 */

import { useEffect, useRef } from 'react';

export function useInterval(callback: () => void, delayMs: number | null): void {
  const fnRef = useRef(callback);
  fnRef.current = callback;

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => fnRef.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
