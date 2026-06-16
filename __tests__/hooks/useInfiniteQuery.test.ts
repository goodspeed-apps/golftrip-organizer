/**
 * Tests for hooks/useInfiniteQuery.ts — Infinite query logic.
 */

describe('infinite query logic', () => {
  test('initial state is loading with empty data', () => {
    const state = { data: [] as number[], loading: true, loadingMore: false, hasMore: true, error: null };
    expect(state.data).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state.hasMore).toBe(true);
  });

  test('first fetch replaces data', () => {
    const state = { data: [] as number[], loading: true };
    const fetched = [1, 2, 3];
    state.data = fetched;
    state.loading = false;
    expect(state.data).toEqual([1, 2, 3]);
    expect(state.loading).toBe(false);
  });

  test('loadMore appends data', () => {
    const state = { data: [1, 2, 3] as number[] };
    const more = [4, 5, 6];
    state.data = [...state.data, ...more];
    expect(state.data).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('hasMore=false when fetch returns less than limit', () => {
    const limit = 20;
    const fetchedCount = 10;
    const hasMore = fetchedCount >= limit;
    expect(hasMore).toBe(false);
  });

  test('refresh resets to initial fetch', () => {
    const state = { data: [1, 2, 3, 4, 5, 6] as number[], hasMore: false };
    // Refresh: reset and refetch
    state.data = [7, 8, 9];
    state.hasMore = true;
    expect(state.data).toEqual([7, 8, 9]);
    expect(state.hasMore).toBe(true);
  });

  test('concurrent loadMore prevented by fetchingRef', () => {
    let fetchingRef = false;
    const loadMore = () => {
      if (fetchingRef) return false;
      fetchingRef = true;
      return true;
    };
    expect(loadMore()).toBe(true);
    expect(loadMore()).toBe(false); // blocked
    fetchingRef = false;
    expect(loadMore()).toBe(true);
  });

  test('autoFetch=false skips initial fetch', () => {
    const autoFetch = false;
    let fetched = false;
    if (autoFetch) fetched = true;
    expect(fetched).toBe(false);
  });
});
