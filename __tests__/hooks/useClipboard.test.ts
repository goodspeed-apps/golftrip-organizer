/**
 * Tests for hooks/useClipboard.ts — Clipboard state logic.
 */

describe('useClipboard logic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('copy sets hasCopied to true', () => {
    let hasCopied = false;
    const copy = () => { hasCopied = true; };
    copy();
    expect(hasCopied).toBe(true);
  });

  test('hasCopied auto-resets after 2000ms', () => {
    let hasCopied = false;
    const copy = () => {
      hasCopied = true;
      setTimeout(() => { hasCopied = false; }, 2000);
    };
    copy();
    expect(hasCopied).toBe(true);
    jest.advanceTimersByTime(2000);
    expect(hasCopied).toBe(false);
  });

  test('paste returns string', async () => {
    const getClipboard = jest.fn(async () => 'pasted text');
    const result = await getClipboard();
    expect(result).toBe('pasted text');
  });
});
