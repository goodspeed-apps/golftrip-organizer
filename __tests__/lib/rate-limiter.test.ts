/**
 * Tests for lib/rate-limiter.ts — Sliding window rate limiter.
 */

import { createRateLimiter } from '../../lib/rate-limiter';

describe('createRateLimiter', () => {
  test('allows requests within limit', () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 1000 });
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
  });

  test('blocks when over limit', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  test('allows after window expires', () => {
    jest.useFakeTimers();
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 100 });
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
    jest.advanceTimersByTime(150);
    expect(limiter.tryAcquire()).toBe(true);
    jest.useRealTimers();
  });

  test('reset clears all timestamps', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 10000 });
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
    limiter.reset();
    expect(limiter.tryAcquire()).toBe(true);
  });
});
