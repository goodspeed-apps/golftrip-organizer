/**
 * GAS Template, Service Errors
 *
 * `ServiceError` is the generic typed error for new services. It carries a
 * symbolic string `code` (e.g. "media.413") plus a numeric `status`.
 *
 * `MediaError` (in services/media.ts) is the older type for media-specific
 * errors and exposes `code: number` for back-compat with existing callers and
 * tests. New services should reach for `ServiceError` directly. Both classes
 * expose a `readonly status: number` field, so callers needing only HTTP-style
 * status semantics can treat them uniformly.
 */
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
