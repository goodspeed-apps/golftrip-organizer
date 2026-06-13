/**
 * GAS Template, useAsync
 *
 * Manages async operation state: loading, data, error.
 * Replaces the common useState + useEffect + try/catch pattern.
 *
 * The hook always calls the latest version of asyncFn (via ref pattern),
 * so callers don't need to worry about stale closures. If you need
 * re-execution when a dependency changes, create a new function identity:
 *   const { data } = useAsync(useCallback(() => fetchItem(id), [id]));
 *
 * Usage:
 *   const { data, loading, error, refetch } = useAsync(() => fetchItems());
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAsync<T>(asyncFn: () => Promise<T>): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => { mountedRef.current = false; };
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
