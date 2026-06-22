import { gzipSync } from 'https://deno.land/x/compress@v0.4.5/mod.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { writeAuditLog } from '../_shared/audit-log.ts';
import { enqueueJob } from '../_shared/jobs.ts';
import { log } from '../_shared/edge-logger.ts';
import { appName } from '../_shared/app-config.ts';

// Tables to export. DevAgent appends app-specific tables.
const EXPORT_TABLES = [
  'profiles',
  'push_tokens',
  'notifications',
  'user_bookmarks',
  'feedback',
  'consent_log',
  'credit_balances',
  'credit_ledger',
  'transactions',
  'cost_usage',
  'account_deletion_log',
  'data_export_requests',
];

const STORAGE_BUCKET = 'data-exports';
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

interface BuildPayload { requestId: string; userId: string; }

export async function handleBuildDataExport(
  raw: Record<string, unknown>,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const { requestId, userId } = raw as unknown as BuildPayload;
  if (!requestId || !userId) throw new Error('build_data_export: missing requestId or userId');

  const client = serviceClient();
  await client.from('data_export_requests').update({ status: 'processing' }).eq('id', requestId);

  try {
const results = await Promise.all(EXPORT_TABLES.map(async (table) => {
      const userColumn = table === 'profiles' ? 'id' : 'user_id';
      const { data, error } = await client.from(table).select('*').eq(userColumn, userId);
      return { table, data: data ?? [], error };
    }));
    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      const failedTables = failed.map((f) => f.table);
      log('error', 'build-data-export', 'table_query_failed', {
        tables: failedTables,
        errors: failed.map((f) => String(f.error)),
      });
      throw new Error(`Export failed for tables: ${failedTables.join(', ')}`);
    }
    const payload: Record<string, unknown[]> = {};
    for (const { table, data } of results) payload[table] = data;

    const jsonStr = JSON.stringify({
      exported_at: new Date().toISOString(),
      user_id: userId,
      data: payload,
    }, null, 2);
    const gz = gzipSync(new TextEncoder().encode(jsonStr));

    const storagePath = `${userId}/${requestId}.json.gz`;

    const { error: uploadErr } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, gz, {
        contentType: 'application/gzip',
        upsert: true,
      });
    if (uploadErr) throw uploadErr;

    const { data: signed, error: signErr } = await client.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw signErr;

    const downloadUrl = signed?.signedUrl ?? '';
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

await client.from('data_export_requests').update({
      status: 'completed',
      storage_path: storagePath,
      expires_at: expiresAt,
      completed_at: new Date().toISOString(),
    }).eq('id', requestId);

    const { data: userData } = await client.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (email) {
      await enqueueJob({
        kind: 'send_email',
        payload: {
          template: 'data_export',
          to: email,
          vars: {
            appName: appName(),
            downloadUrl,
            expiresAt,
          },
          userId,
        },
      });
    }

    await writeAuditLog({
      actorId: userId,
      actorType: 'system',
      action: 'export.completed',
      targetTable: 'data_export_requests',
      targetId: requestId,
      targetData: { storagePath, expiresAt },
    });

    log('info', 'build-data-export', 'completed', { requestId, userId, storagePath });
    return { storagePath, downloadUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await client.from('data_export_requests').update({
      status: 'failed',
      error: msg,
      completed_at: new Date().toISOString(),
    }).eq('id', requestId);
    throw e;
  }
}