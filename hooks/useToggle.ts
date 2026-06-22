/**
 * GAS Template, useToggle Hook
 *
 * Simple boolean toggle with stable setter functions.
 */

import { useState, useCallback } from 'react';

export function useToggle(initial = false): [boolean, { toggle: () => void; setTrue: () => void; setFalse: () => void }] {
  const [value, setValue] = useState(initial);

  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return [value, { toggle, setTrue, setFalse }];
}
