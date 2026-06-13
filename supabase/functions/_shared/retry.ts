export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
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