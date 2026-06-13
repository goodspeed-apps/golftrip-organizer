/**
 * Tests for lib/retry.ts — Retry with exponential backoff.
 */

import { retryWithBackoff, isTransientNon4xxError } from '../../lib/retry';

describe('retryWithBackoff', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  test('succeeds on first try', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on failure', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');

    const promise = retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10, maxDelay: 100 });
    // Fast-forward timers for retries
    for (let i = 0; i < 3; i++) {
      await Promise.resolve(); // Let rejection handler run
      jest.advanceTimersByTime(200);
    }
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('throws after maxRetries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));

    const promise = retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10, maxDelay: 50 });
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(200);
    }
    await expect(promise).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

test('shouldRetry false stops early', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('no retry'));

    const promise = retryWithBackoff(fn, {
      maxRetries: 5,
      baseDelay: 10,
      shouldRetry: () => false,
    });
    await expect(promise).rejects.toThrow('no retry');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('isTransientNon4xxError', () => {
  test('retries on a plain network/timeout error', () => {
    expect(isTransientNon4xxError(new Error('network timeout'))).toBe(true);
  });

  test('skips on jwt / forbidden / unauthorized in any case', () => {
    expect(isTransientNon4xxError(new Error('JWT expired'))).toBe(false);
    expect(isTransientNon4xxError(new Error('Forbidden RLS'))).toBe(false);
    expect(isTransientNon4xxError(new Error('Unauthorized'))).toBe(false);
  });

  test('retries 5xx status codes', () => {
    expect(isTransientNon4xxError(new Error('status: 502 bad gateway'))).toBe(true);
    expect(isTransientNon4xxError(new Error('HTTP 503'))).toBe(true);
  });

  test('skips 4xx status codes other than 429', () => {
    expect(isTransientNon4xxError(new Error('status: 404 not found'))).toBe(false);
    expect(isTransientNon4xxError(new Error('HTTP 400 bad request'))).toBe(false);
    expect(isTransientNon4xxError(new Error('code=403 denied'))).toBe(false);
  });

  test('retries 429 (rate-limit) even though it lives in the 4xx range', () => {
    expect(isTransientNon4xxError(new Error('status: 429 too many'))).toBe(true);
    expect(isTransientNon4xxError(new Error('HTTP 429 rate limited'))).toBe(true);
  });

  test('does NOT match unrelated 4xx-looking digits in free-form text', () => {
    // Regression: the old loose `\b4\d\d\b` would skip retry on "request id 4321".
    // The new helper only matches digits prefixed by status/code/HTTP.
    expect(isTransientNon4xxError(new Error('request id 4321 timed out'))).toBe(true);
    expect(isTransientNon4xxError(new Error('connection reset (peer 4567)'))).toBe(true);
  });
});
