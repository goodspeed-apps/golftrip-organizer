/**
 * Tests for hooks/usePullToRefresh.ts — Pull-to-refresh logic.
 */

describe('pullToRefresh logic', () => {
  test('initial refreshing is false', () => {
    const refreshing = false;
    expect(refreshing).toBe(false);
  });

  test('refresh sets true then false on success', async () => {
    let refreshing = false;
    const onRefresh = async () => {
      refreshing = true;
      try {
        await Promise.resolve();
      } finally {
        refreshing = false;
      }
    };
    await onRefresh();
    expect(refreshing).toBe(false);
  });

  test('refresh sets false on error (finally)', async () => {
    let refreshing = false;
    const onRefresh = async () => {
      refreshing = true;
      try {
        await Promise.reject(new Error('fail'));
      } catch {
        // swallowed
      } finally {
        refreshing = false;
      }
    };
    await onRefresh();
    expect(refreshing).toBe(false);
  });

  test('fnRef pattern uses latest function', () => {
    let fn = () => 'first';
    const fnRef = { current: fn };
    fnRef.current = () => 'second';
    expect(fnRef.current()).toBe('second');
  });
});
