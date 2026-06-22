// supabase/functions/_shared/edge-logger.ts
// Structured JSON logging.

import { captureException } from './sentry.ts';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(level: LogLevel, fn: string, msg: string, extra?: Record<string, unknown>): void {
  let line: string;
  try {
    line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      fn,
      msg,
      ...(extra ?? {}),
    });
  } catch {
    line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      fn,
      msg,
      extra: '[unserializable]',
    });
  }
  // eslint-disable-next-line no-console
  console.log(line);
}

export function reportException(fn: string, err: unknown, extra?: Record<string, unknown>): void {
  log('error', fn, err instanceof Error ? err.message : String(err), {
    ...(extra ?? {}),
    stack: err instanceof Error ? err.stack : undefined,
  });
// Forward to Sentry (no-op if SENTRY_DSN unset). Fire-and-forget — never block the caller.
  try {
    captureException(err, extra);
  } catch {
    // ignore — Sentry forwarding is best-effort
  }
}