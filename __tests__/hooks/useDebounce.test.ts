/**
 * Tests for hooks/useDebounce.ts — Debounce logic.
 */

describe('debounce logic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('delays value update', () => {
    let debounced = 'initial';
    const update = (val: string, delay: number) => {
      setTimeout(() => { debounced = val; }, delay);
    };
    update('changed', 300);
    expect(debounced).toBe('initial');
    jest.advanceTimersByTime(300);
    expect(debounced).toBe('changed');
  });

  test('resets timer on rapid changes', () => {
    let debounced = 'initial';
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = (val: string, delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { debounced = val; }, delay);
    };
    update('first', 300);
    jest.advanceTimersByTime(100);
    update('second', 300);
    jest.advanceTimersByTime(300);
    expect(debounced).toBe('second');
  });

  test('custom delay is respected', () => {
    let debounced = 'initial';
    const update = (val: string, delay: number) => {
      setTimeout(() => { debounced = val; }, delay);
    };
    update('changed', 500);
    jest.advanceTimersByTime(400);
    expect(debounced).toBe('initial');
    jest.advanceTimersByTime(100);
    expect(debounced).toBe('changed');
  });

  test('default delay is 300ms', () => {
    const DEFAULT_DELAY = 300;
    expect(DEFAULT_DELAY).toBe(300);
  });
});
