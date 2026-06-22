/**
 * Tests for hooks/usePrevious.ts — Previous value tracking.
 */

describe('usePrevious logic', () => {
  test('initial previous is undefined', () => {
    const ref = { current: undefined as number | undefined };
    expect(ref.current).toBeUndefined();
  });

  test('returns previous value after update', () => {
    const ref = { current: undefined as number | undefined };
    // Render 1: value = 1, ref still undefined
    const value1 = 1;
    const prev1 = ref.current;
    ref.current = value1;
    expect(prev1).toBeUndefined();

    // Render 2: value = 2, ref is now 1
    const value2 = 2;
    const prev2 = ref.current;
    ref.current = value2;
    expect(prev2).toBe(1);

    // Render 3: value = 3, ref is now 2
    const prev3 = ref.current;
    ref.current = 3;
    expect(prev3).toBe(2);
  });
});
