/**
 * GAS Template, usePullToRefresh
 *
 * Wraps an async refresh function with refreshing state management.
 * Returns { refreshing, onRefresh }, plug directly into RefreshControl.
 *
 * Usage:
 *   const { refreshing, onRefresh } = usePullToRefresh(fetchData);
 *   <FlatList refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />
 */

import { useState, useCallback, useRef } from 'react';

export function usePullToRefresh(refreshFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fnRef.current();
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
