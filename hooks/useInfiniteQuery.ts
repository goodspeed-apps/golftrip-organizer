/**
 * GAS Template, useInfiniteQuery
 *
 * Cursor-based infinite pagination hook.
 *
 * Usage:
 *   const { data, loading, loadingMore, hasMore, loadMore, refresh } = useInfiniteQuery(
 *     async (cursor, limit) => {
 *       const { data } = await supabase.from('posts').select('*').range(cursor, cursor + limit - 1);
 *       return { data: data ?? [], hasMore: (data?.length ?? 0) === limit };
 *     },
 *     { limit: 20 }
 *   );
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface FetchResult<T> {
  data: T[];
  hasMore: boolean;
}

interface UseInfiniteQueryOptions {
  /** Items per page (default: 20) */
  limit?: number;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

export function useInfiniteQuery<T>(
  fetcher: (cursor: number, limit: number) => Promise<FetchResult<T>>,
  options: UseInfiniteQueryOptions = {},
) {
  const { limit = 20, autoFetch = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const cursorRef = useRef(0);
  const mountedRef = useRef(true);
  const fnRef = useRef(fetcher);
  fnRef.current = fetcher;

  const fetchPage = useCallback(async (reset: boolean) => {
    if (reset) {
      cursorRef.current = 0;
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const result = await fnRef.current(cursorRef.current, limit);
      if (!mountedRef.current) return;

      if (reset) {
        setData(result.data);
      } else {
        setData(prev => [...prev, ...result.data]);
      }
      cursorRef.current += result.data.length;
      setHasMore(result.hasMore);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [limit]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoFetch) fetchPage(true);
    return () => { mountedRef.current = false; };
  }, [fetchPage, autoFetch]);

  const fetchingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (!loadingMore && !loading && hasMore && !fetchingRef.current) {
      fetchingRef.current = true;
      fetchPage(false).finally(() => { fetchingRef.current = false; });
    }
  }, [loadingMore, loading, hasMore, fetchPage]);

  const refresh = useCallback(() => {
    fetchPage(true);
  }, [fetchPage]);

  return { data, loading, loadingMore, error, hasMore, loadMore, refresh };
}
