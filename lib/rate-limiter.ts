/**
 * GAS Template, Rate Limiter
 *
 * Sliding window counter to prevent rapid button taps or API spam.
 */

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimiter {
  tryAcquire(): boolean;
  reset(): void;
}

/** Create a sliding-window rate limiter. */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { maxRequests, windowMs } = options;
  let timestamps: number[] = [];

  return {
    tryAcquire(): boolean {
      const now = Date.now();
      timestamps = timestamps.filter(t => now - t < windowMs);
      if (timestamps.length >= maxRequests) return false;
      timestamps.push(now);
      return true;
    },
    reset(): void {
      timestamps = [];
    },
  };
}
