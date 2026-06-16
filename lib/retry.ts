/**
 * GAS Template, Retry with Exponential Backoff
 *
 * Generic retry utility for transient failures (network, 5xx, etc.).
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Shared "retry on network/timeout/5xx, skip on 4xx auth/RLS" predicate.
 *
 * The previous regex `\b4\d\d\b` matched any 3-digit substring starting with 4
 * (e.g. "request id 4321" tripped a false negative). This tighter version
 * only matches digits explicitly framed as a status/code/HTTP value, so
 * unrelated 4xx-looking substrings don't poison the retry decision.
 */
export function isTransientNon4xxError(err: unknown): boolean {
  // Structured errors (ServiceError, fetch Response wrappers) expose a numeric
  // `status` property, prefer it over message regex, which is brittle.
if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number') {
      if (status >= 400 && status < 500 && status !== 429) return false;
      // 501 Not Implemented and 505 HTTP Version Not Supported are permanent
      // capability gaps, retrying won't change the answer.
      if (status === 501 || status === 505) return false;
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('jwt') || lower.includes('forbidden') || lower.includes('unauthorized')) {
    return false;
  }
  const m = msg.match(/(?:status|code|HTTP)\s*[:=]?\s*(\d{3})/i);
  if (m) {
    const status = parseInt(m[1], 10);
    if (status >= 400 && status < 500 && status !== 429) return false;
  }
  return true;
}

const DEFAULTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 5000,
  shouldRetry: () => true,
};

/** Retry a function with exponential backoff + jitter. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry } = { ...DEFAULTS, ...options };

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries || !shouldRetry(err)) break;
      const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
      const jitter = delay * 0.1 * Math.random();
      await new Promise(r => setTimeout(r, delay + jitter));
    }
  }
  throw lastError;
}
