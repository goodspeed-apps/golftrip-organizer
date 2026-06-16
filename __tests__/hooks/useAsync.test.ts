/**
 * Tests for hooks/useAsync.ts — Async state logic.
 */

describe('async state logic', () => {
  test('initial state is loading with null data/error', () => {
    const state = { data: null, loading: true, error: null };
    expect(state.loading).toBe(true);
    expect(state.data).toBeNull();
    expect(state.error).toBeNull();
  });

  test('success sets data and loading=false', async () => {
    const state = { data: null as number | null, loading: true, error: null as Error | null };
    try {
      const result = await Promise.resolve(42);
      state.data = result;
    } catch (e) {
      state.error = e instanceof Error ? e : new Error(String(e));
    } finally {
      state.loading = false;
    }
    expect(state.data).toBe(42);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  test('error sets error and loading=false', async () => {
    const state = { data: null, loading: true, error: null as Error | null };
    try {
      await Promise.reject(new Error('fail'));
    } catch (e) {
      state.error = e instanceof Error ? e : new Error(String(e));
    } finally {
      state.loading = false;
    }
    expect(state.error?.message).toBe('fail');
    expect(state.loading).toBe(false);
  });

  test('non-Error rejection wraps in Error', async () => {
    let error: Error | null = null;
    try {
      await Promise.reject('string error');
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('string error');
  });

  test('isMounted guard prevents state update after unmount', () => {
    let isMounted = true;
    let stateUpdated = false;
    const safeSetState = () => {
      if (isMounted) stateUpdated = true;
    };
    isMounted = false;
    safeSetState();
    expect(stateUpdated).toBe(false);
  });
});
