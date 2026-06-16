// Sentry init for Deno Edge Functions. No-ops if SENTRY_DSN unset.

import * as Sentry from 'https://esm.sh/@sentry/deno@8';

let _initialized = false;

export function initSentry(fnName: string): void {
  if (_initialized) return;
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) {
    _initialized = true;
    return;
  }
  Sentry.init({
    dsn,
    serverName: fnName,
    tracesSampleRate: parseTracesSampleRate(Deno.env.get('SENTRY_TRACES_SAMPLE_RATE')),
    environment: Deno.env.get('DEPLOY_ENV') ?? 'production',
  });
  _initialized = true;
}

export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  if (!Deno.env.get('SENTRY_DSN')) return;
  Sentry.captureException(err, { extra });
}

export function captureMessage(msg: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info'): void {
  if (!Deno.env.get('SENTRY_DSN')) return;
  Sentry.captureMessage(msg, level);
}

export async function withTransaction<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!Deno.env.get('SENTRY_DSN')) return fn();
  return Sentry.startSpan({ name, op }, () => fn()) as Promise<T>;
}

function parseTracesSampleRate(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.1;
  return Math.min(1, Math.max(0, n));
}