/**
 * GAS Template, usePrevious
 *
 * Returns the value from the previous render.
 * Useful for comparing old vs new values in effects.
 */

import { useRef, useEffect } from 'react';

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
