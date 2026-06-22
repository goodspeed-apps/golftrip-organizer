/**
 * GAS Template, useSearch Hook
 *
 * Debounced search hook for filtering local data or calling Supabase full-text search.
 *
 * Features:
 * - Debounced query input (uses useDebounce hook) to avoid excessive API calls
 * - Two modes: client-side filtering or Supabase FTS (full-text search)
 * - Generic: works with any data type via a configurable filter function
 * - Loading and error states for async search operations
 * - Config-aware: reads search settings from gasConfig.features.search
 * - Minimum query length to avoid trivial searches
 *
 * Dependencies: useDebounce, @supabase/supabase-js, lib/supabase, gas.config
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { supabase } from '@/lib/supabase';
import { captureEvent } from '@/lib/posthog';
import { captureException } from '@/lib/sentry';
import { gasConfig } from '../gas.config';

// --- Config ---
const SEARCH_CONFIG = gasConfig.features.search;
const DEFAULT_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

// --- Types ---

export interface UseSearchOptions<T> {
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Minimum query length before searching (default: 2) */
  minLength?: number;
  /**
   * Client-side filter function.
   * Called for each item in `data` with the current query.
   * Return true to include the item in results.
   * Only used when mode is 'client-side'.
   */
  filterFn?: (item: T, query: string) => boolean;
  /**
   * Supabase FTS configuration.
   * Only used when mode is 'supabase-fts'.
   */
  fts?: {
    /** Supabase table name to search */
    table: string;
    /** Column name with the tsvector or to search via ilike fallback */
    column: string;
    /** Select columns (default: '*') */
    select?: string;
    /** Additional filters to apply (e.g., { user_id: '...' }) */
    filters?: Record<string, unknown>;
    /** Maximum results to return (default: 50) */
    limit?: number;
    /** Use Supabase textSearch (true) or ilike fallback (false, default) */
    useTextSearch?: boolean;
  };
}

export interface UseSearchResult<T> {
  /** Current query string */
  query: string;
  /** Debounced query string (delayed by debounceMs) */
  debouncedQuery: string;
  /** Search results */
  results: T[];
  /** Loading state (true during async search) */
  isSearching: boolean;
  /** Error message from last failed search, or null */
  error: string | null;
  /** Update the query string */
  setQuery: (q: string) => void;
  /** Clear query and results */
  clear: () => void;
}

/**
 * useSearch, Debounced search hook.
 *
 * @param data - Array of items for client-side filtering (ignored for FTS mode)
 * @param options - Search configuration
 * @returns UseSearchResult<T>
 *
 * Usage (client-side):
 *   const { query, setQuery, results } = useSearch(items, {
 *     filterFn: (item, q) => item.name.toLowerCase().includes(q.toLowerCase()),
 *   });
 *
 * Usage (Supabase FTS):
 *   const { query, setQuery, results, isSearching } = useSearch<MyRow>([], {
 *     fts: { table: 'posts', column: 'title', useTextSearch: true },
 *   });
 */
export function useSearch<T>(
  data: T[] = [],
  options: UseSearchOptions<T> = {},
): UseSearchResult<T> {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    minLength = MIN_QUERY_LENGTH,
    filterFn,
    fts,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, debounceMs);

  // Track the latest search request to avoid stale results
  const latestRequestRef = useRef(0);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Determine search mode from config or options
  const mode = fts ? 'supabase-fts' : 'client-side';

  // --- Client-side filtering ---
  useEffect(() => {
    if (mode !== 'client-side') return;

    if (!debouncedQuery || debouncedQuery.length < minLength) {
      setResults(data);
      return;
    }

    if (filterFn) {
      setResults(data.filter(item => filterFn(item, debouncedQuery)));
    } else {
      // Default: no filter function provided, return all data
      setResults(data);
    }
  }, [debouncedQuery, data, filterFn, minLength, mode]);

  // --- Supabase FTS ---
  useEffect(() => {
    if (mode !== 'supabase-fts' || !fts) return;

    if (!debouncedQuery || debouncedQuery.length < minLength) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++latestRequestRef.current;
    setIsSearching(true);
    setError(null);
    const searchStart = Date.now();

    (async () => {
      try {
        let queryBuilder = supabase
          .from(fts.table)
          .select(fts.select ?? '*');

        // Apply search
        if (fts.useTextSearch) {
          queryBuilder = queryBuilder.textSearch(fts.column, debouncedQuery);
        } else {
          // ilike fallback for simpler searches
          const escaped = debouncedQuery.replace(/[%_\\]/g, '\\$&');
          queryBuilder = queryBuilder.ilike(fts.column, `%${escaped}%`);
        }

        // Apply additional filters (type-safe)
        if (fts.filters) {
          for (const [key, value] of Object.entries(fts.filters)) {
            if (value === undefined) continue;
            if (value === null) {
              queryBuilder = queryBuilder.is(key, null);
            } else {
              queryBuilder = queryBuilder.eq(key, value as string | number | boolean);
            }
          }
        }

        // Limit results
        queryBuilder = queryBuilder.limit(fts.limit ?? 50);

        const { data: rows, error: dbError } = await queryBuilder;

        // Only update if this is still the latest request (avoid stale results)
        if (requestId !== latestRequestRef.current) return;

        if (dbError) {
          setError(dbError.message);
          setResults([]);
        } else {
          const resultItems = (rows as T[]) ?? [];
          setResults(resultItems);
          captureEvent('search_performed', {
            query_length: debouncedQuery.length,
            results_count: resultItems.length,
            duration_ms: Date.now() - searchStart,
          });
        }
      } catch (e) {
        if (requestId !== latestRequestRef.current) return;
        setError(e instanceof Error ? e.message : 'Search failed');
        setResults([]);
        captureException(e, { component: 'useSearch', action: 'fts_search' });
      } finally {
        if (requestId === latestRequestRef.current && isMountedRef.current) {
          setIsSearching(false);
        }
      }
    })();
  }, [debouncedQuery, fts, minLength, mode]);

  // --- Clear ---
  const clear = useCallback(() => {
    setQuery('');
    setResults(mode === 'client-side' ? data : []);
    setError(null);
  }, [data, mode]);

  return {
    query,
    debouncedQuery,
    results,
    isSearching,
    error,
    setQuery,
    clear,
  };
}
