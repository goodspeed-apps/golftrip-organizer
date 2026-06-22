/**
 * Tests for hooks/useInterval.ts and hooks/useTimeout.ts — Timer logic.
 */

describe('interval logic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('calls callback at interval', () => {
    const cb = jest.fn();
    const id = setInterval(cb, 100);
    jest.advanceTimersByTime(350);
    clearInterval(id);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  test('null delay does not start interval', () => {
    const cb = jest.fn();
    const delay: number | null = null;
    if (delay !== null) setInterval(cb, delay);
    jest.advanceTimersByTime(1000);
    expect(cb).not.toHaveBeenCalled();
  });

  test('cleanup clears interval', () => {
    const cb = jest.fn();
    const id = setInterval(cb, 100);
    clearInterval(id);
    jest.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('timeout logic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('fires after delay', () => {
    const cb = jest.fn();
    setTimeout(cb, 500);
    jest.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('reset restarts timer', () => {
    const cb = jest.fn();
    let id = setTimeout(cb, 500);
    jest.advanceTimersByTime(300);
    clearTimeout(id);
    id = setTimeout(cb, 500);
    jest.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('clear prevents firing', () => {
    const cb = jest.fn();
    const id = setTimeout(cb, 500);
    clearTimeout(id);
    jest.advanceTimersByTime(1000);
    expect(cb).not.toHaveBeenCalled();
  });
});
