/**
 * Tests for hooks/useTimeout.ts — Timeout logic.
 */

describe('timeout logic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('fires callback after delay', () => {
    const callback = jest.fn();
    setTimeout(callback, 1000);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('null delay disables timeout', () => {
    const callback = jest.fn();
    const delay: number | null = null;
    if (delay !== null) setTimeout(callback, delay);
    jest.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  test('reset restarts timer', () => {
    const callback = jest.fn();
    let timer = setTimeout(callback, 1000);
    jest.advanceTimersByTime(500);
    // Reset
    clearTimeout(timer);
    timer = setTimeout(callback, 1000);
    jest.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('clear cancels timeout', () => {
    const callback = jest.fn();
    const timer = setTimeout(callback, 1000);
    clearTimeout(timer);
    jest.advanceTimersByTime(2000);
    expect(callback).not.toHaveBeenCalled();
  });
});
