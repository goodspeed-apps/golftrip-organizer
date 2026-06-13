// supabase/functions/migrate_anonymous_data/handler.ts
// Pure business logic — no Deno std server import so this module is testable
// in Node/Jest (following the send_push/handler.ts pattern in this repo).

// Deno global — present at runtime in the edge runtime and shimmed in tests.
declare const Deno: { env: { get(key: string): string | undefined } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

import { serviceClient, userClient } from '../_shared/edge-client.ts';
import { json, err, handleOptions } from '../_shared/edge-response.ts';
import { HttpError } from '../_shared/http-error.ts';
import { reportException } from '../_shared/edge-logger.ts';
import { requireCronSecret } from '../_shared/edge-auth.ts';

/**
 * Auth gate for migrate_anonymous_data.
 *
 * Accepts two callers:
 *   1. Operator cron run  — x-cron-secret header matches CRON_SECRET env var.
 *   2. Client-initiated   — Bearer JWT for the permanent user (the user who just
 *      upgraded their anonymous session).  We verify the JWT is valid and extract
 *      the caller's user ID so handleMigrateAnonymous can confirm it matches
 *      permanentUserId in the request body.
 *
 * The old service-role path is removed: supabase.functions.invoke from the
 * client sends the user's JWT, not the service-role key.
 */
export async function requireAuth(
  req: Request,
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): Promise<{ callerUserId: string | null } | Response> {
  // Cron path — operator-initiated, no user constraint.
  // If x-cron-secret header is present, route exclusively through cron validation (C1).
  if (req.headers.get('x-cron-secret') !== null) {
    try {
      requireCronSecret(req, envGet);
    } catch {
      return err('Unauthorized', 401, 'cron_secret_invalid');
    }
    return { callerUserId: null };
  }

  // User-JWT path — client-initiated after anonymous upgrade
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return err('Unauthorized', 401, 'auth_required');
  }

  const client = userClient(authHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return err('Unauthorized', 401, 'auth_invalid');
  }

  return { callerUserId: data.user.id };
}

export async function handleMigrateAnonymous(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== 'POST') return err('Method not allowed', 405);

  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  let body: { anonUserId?: string; permanentUserId?: string; tables?: string[] };
  try {
    body = (await req.json()) as { anonUserId?: string; permanentUserId?: string; tables?: string[] };
  } catch {
    return err('Invalid JSON body', 400, 'invalid_body');
  }

  const { anonUserId, permanentUserId, tables } = body;

  if (!anonUserId || !permanentUserId || !Array.isArray(tables)) {
    return err(
      'Missing required fields: anonUserId, permanentUserId, tables',
      400,
      'missing_fields',
    );
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(anonUserId) || !UUID_RE.test(permanentUserId)) {
    return err('anonUserId and permanentUserId must be valid UUIDs', 400, 'invalid_uuid');
  }

  // User-JWT path: verify the caller IS the permanent user they claim to be.
  // callerUserId is null only for cron-secret requests which bypass this check.
  if (authResult.callerUserId !== null && authResult.callerUserId !== permanentUserId) {
    return err('Forbidden: permanentUserId must match the authenticated user', 403, 'user_mismatch');
  }

  const sb: AnyClient = serviceClient();

  // Idempotency check: if this anonUserId was already migrated to this permanent
  // user, return the existing record rather than creating a duplicate.
  const { data: existing } = await sb
    .from('anonymous_migrations')
    .select('id, status, table_rowcounts')
    .eq('anon_user_id', anonUserId)
    .eq('permanent_user_id', permanentUserId)
    .eq('status', 'completed')
    .maybeSingle();

  if (existing) {
    return json({
      status: 'completed',
      table_rowcounts: (existing as { table_rowcounts: Record<string, number> }).table_rowcounts ?? {},
    });
  }

  // Insert a pending migration record first
  const { data: migrationRow, error: insertError } = await sb
    .from('anonymous_migrations')
    .insert({
      anon_user_id: anonUserId,
      permanent_user_id: permanentUserId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !migrationRow) {
    reportException('migrate_anonymous_data', insertError);
    return err('Failed to create migration record', 500, 'migration_insert_failed');
  }

  const migrationId: string = (migrationRow as { id: string }).id;

  try {
    // Call the transactional SQL function (single PL/pgSQL call = atomic)
    const { data: rpcResult, error: rpcError } = await sb.rpc(
      'migrate_anonymous_user_data',
      {
        p_anon_user_id: anonUserId,
        p_permanent_user_id: permanentUserId,
        p_tables: tables,
      },
    );

    if (rpcError) {
      throw new HttpError(500, (rpcError as { message?: string }).message ?? 'RPC failed');
    }

    const tableRowcounts = (rpcResult ?? {}) as Record<string, number>;

    // Mark migration completed
    await sb
      .from('anonymous_migrations')
      .update({
        status: 'completed',
        table_rowcounts: tableRowcounts,
        completed_at: new Date().toISOString(),
      })
      .eq('id', migrationId);

    return json({ status: 'completed', table_rowcounts: tableRowcounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    reportException('migrate_anonymous_data', e);

    // Mark migration failed
    await sb
      .from('anonymous_migrations')
      .update({ status: 'failed', error: msg })
      .eq('id', migrationId);

    if (e instanceof HttpError) {
      return err(msg, e.status, 'migration_failed');
    }
    return err(msg, 500, 'migration_failed');
  }
}
