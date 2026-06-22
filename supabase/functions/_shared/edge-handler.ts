// supabase/functions/_shared/edge-handler.ts
// Shared admin-gated handler wrapper. Eliminates the duplicated index.ts
// skeleton across edge functions (OPTIONS handling, admin auth, JSON parsing,
// error envelope, structured exception reporting).
//
// SECURITY (P7-7 / H-7): adminHandler previously used the deprecated
// `requireAdminKey` shared secret (x-admin-key header → ADMIN_API_KEY).
// It now uses `requireCronBearer` (Authorization: Bearer <CRON_SECRET>) with
// a constant-time compare. Server-to-server callers (operator-implemented
// OAuth callbacks, webhook receivers, send-email/send_push dispatchers) MUST
// update their Authorization header accordingly. Human-admin endpoints
// continue to use `requireAdminJwt` (JWT + profiles.role check).

import { handleOptions, json, err } from './edge-response.ts';
import { requireCronBearer, requireUserAuth } from './edge-auth.ts';
import { reportException } from './edge-logger.ts';
import { initSentry, withTransaction } from './sentry.ts';
import { setActorContext } from './audit-log.ts';
import { HttpError } from './http-error.ts';

export interface AdminHandlerOpts {
  /** Function name used for log/exception tags. */
  name: string;
  /** Pure handler that takes a JSON body and returns the success result. */
  handler: (body: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
  /** Code returned in the 500 body on unhandled errors. */
  errorCode: string;
  /**
   * Optional custom error mapper. If it returns a Response, that response is
   * used; if it returns null, falls through to the default 500 with errorCode.
   */
  errorMap?: (e: unknown) => Response | null;
}

export function adminHandler(
  opts: AdminHandlerOpts,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    initSentry(opts.name);
    const opt = handleOptions(req);
    if (opt) return opt;
    const denied = requireCronBearer(req);
    if (denied) return denied;

try {
      const body = (await req.json()) as Record<string, unknown>;
      const result = await withTransaction(opts.name, 'edge-function', () => opts.handler(body));
      return json(result);
    } catch (e) {
      reportException(opts.name, e);
      if (opts.errorMap) {
        const mapped = opts.errorMap(e);
        if (mapped) return mapped;
      }
      if (e instanceof HttpError) {
        return err(e.message, e.status, opts.errorCode);
      }
      return err(e instanceof Error ? e.message : String(e), 500, opts.errorCode);
    }
  };
}

export interface PublicHandlerOpts {
  name: string;
  handler: (body: Record<string, unknown>) => Promise<unknown>;
  errorCode: string;
  /** Allowed HTTP methods. Defaults to ['POST']. */
  methods?: string[];
  errorMap?: (e: unknown) => Response | null;
}

export function publicHandler(
  opts: PublicHandlerOpts,
): (req: Request) => Promise<Response> {
  const methods = opts.methods ?? ['POST'];
  return async (req: Request) => {
    initSentry(opts.name);
    const opt = handleOptions(req);
    if (opt) return opt;
    if (!methods.includes(req.method)) return err('Method not allowed', 405);

try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const result = await withTransaction(opts.name, 'edge-function', () =>
        opts.handler(body),
      );
      return json(result);
    } catch (e) {
      reportException(opts.name, e);
      if (opts.errorMap) {
        const mapped = opts.errorMap(e);
        if (mapped) return mapped;
      }
      if (e instanceof HttpError) {
        return err(e.message, e.status, opts.errorCode);
      }
      return err(e instanceof Error ? e.message : String(e), 500, opts.errorCode);
    }
  };
}

export interface UserHandlerOpts {
  name: string;
  handler: (
    ctx: { userId: string; body: Record<string, unknown> },
  ) => Promise<unknown>;
  errorCode: string;
  /** Allowed HTTP methods. Defaults to ['POST']. */
  methods?: string[];
  errorMap?: (e: unknown) => Response | null;
}

export function userHandler(
  opts: UserHandlerOpts,
): (req: Request) => Promise<Response> {
  const methods = opts.methods ?? ['POST'];
  return async (req: Request) => {
    initSentry(opts.name);
    const opt = handleOptions(req);
    if (opt) return opt;
    if (!methods.includes(req.method)) return err('Method not allowed', 405);

    const auth = await requireUserAuth(req);
    if (auth instanceof Response) return auth;

try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      await setActorContext(auth.userId, 'user');
      const result = await withTransaction(opts.name, 'edge-function', () =>
        opts.handler({ userId: auth.userId, body }),
      );
      return json(result);
    } catch (e) {
      reportException(opts.name, e);
      if (opts.errorMap) {
        const mapped = opts.errorMap(e);
        if (mapped) return mapped;
      }
      if (e instanceof HttpError) {
        return err(e.message, e.status, opts.errorCode);
      }
      return err(e instanceof Error ? e.message : String(e), 500, opts.errorCode);
    }
  };
}
