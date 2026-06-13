// supabase/functions/_shared/edge-auth.ts
// Auth gates for Edge Functions.

import { err } from './edge-response.ts';
import { userClient, serviceClient } from './edge-client.ts';
import { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { HttpError } from './http-error.ts';

/**
 * Verifies a Bearer JWT and checks that the caller has profiles.role === 'admin'.
 * Returns { user } on success or a Response (401/403) on failure.
 */
export async function requireAdminJwt(req: Request): Promise<{ user: User } | Response> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return err('Unauthorized', 401, 'auth_required');
  }
  const jwt = auth.slice(7);
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser(jwt);
  if (error || !data.user) {
    return err('Unauthorized', 401, 'auth_invalid');
  }
  const svc = serviceClient();
  const { data: profile, error: profileErr } = await svc
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileErr) return err('Service unavailable', 500, 'profile_lookup_failed');
  if (profile?.role !== 'admin') {
    return err('Forbidden', 403, 'admin_required');
  }
  return { user: data.user };
}

/**
 * Bearer-token gate for server-to-server callers (pg_cron → job-worker,
 * admin-only edge functions invoked from trusted backends). Reads the
 * `Authorization: Bearer <token>` header and compares it to the
 * `CRON_SECRET` env var via constant-time compare (see timingSafeStringEqual).
 *
 * Returns a 401 Response on any mismatch (missing header, missing env, wrong
 * token, malformed header) with a generic message — never leaks whether the
 * secret is unset vs. wrong. envGet is injected for testability; defaults to
 * Deno.env.get.
 *
 * Callers that need to throw instead of returning (e.g. inside a try/catch
 * pipeline) can use requireCronSecret (x-cron-secret header variant).
 */
export function requireCronBearer(
  req: Request,
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): Response | null {
  const cronSecret = envGet('CRON_SECRET');
  const auth = req.headers.get('authorization');
  if (!cronSecret || !auth?.startsWith('Bearer ')) {
    return err('Unauthorized', 401, 'auth_required');
  }
  const provided = auth.slice(7);
  if (!timingSafeStringEqual(provided, cronSecret)) {
    return err('Unauthorized', 401, 'auth_required');
  }
  return null;
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  // Always iterate over max(len) so runtime doesn't leak length information.
  // XOR with 0 (charCodeAt returns NaN→0 for out-of-range index) for the
  // shorter side — the final equality check still returns false when lengths differ.
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length; // seeds non-zero when lengths differ
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Auth gate for cron-triggered functions. Validates x-cron-secret header against
 * the CRON_SECRET env var. Throws HttpError(401) on mismatch so callers can propagate.
 * envGet is injected for testability; defaults to Deno.env.get in production.
 * Hard-fails (throws 401) when CRON_SECRET env is unset — silence is not safe.
 */
export function requireCronSecret(
  req: Request,
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): void {
  const cronSecret = envGet('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret');
  if (!cronSecret || !provided || !timingSafeStringEqual(provided, cronSecret)) {
    throw new HttpError(401, 'Unauthorized: CRON_SECRET required');
  }
}

export async function requireUserAuth(req: Request): Promise<{ userId: string } | Response> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return err('Unauthorized', 401, 'auth_required');
  }
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return err('Unauthorized', 401, 'auth_invalid');
  }
  return { userId: data.user.id };
}
