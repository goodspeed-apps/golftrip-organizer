/**
 * GAS Template, useLocalStorage Hook
 *
 * React state synced with AsyncStorage via lib/storage.ts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getItem, setItem, removeItem } from '../lib/storage';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void, () => void] {
  const [state, setState] = useState<T>(defaultValue);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    getItem<T>(key).then(stored => {
      if (stored !== null && isMounted.current) setState(stored);
    });
    return () => { isMounted.current = false; };
  }, [key]);

  const set = useCallback((value: T) => {
    setState(value);
    setItem(key, value);
  }, [key]);

  const remove = useCallback(() => {
    setState(defaultValue);
    removeItem(key);
  }, [key, defaultValue]);

  return [state, set, remove];
}
