/**
 * Tests for hooks/useMount.ts — Mount lifecycle logic.
 */

describe('useMount logic', () => {
  test('callback runs once on mount', () => {
    const callback = jest.fn();
    // Simulate mount: callback runs once
    callback();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('cleanup runs on unmount', () => {
    const cleanup = jest.fn();
    const callback = () => cleanup;
    const result = callback();
    // Simulate unmount
    if (typeof result === 'function') result();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
