import { serviceClient } from '../_shared/edge-client.ts';
import { writeAuditLog } from '../_shared/audit-log.ts';
import { log } from '../_shared/edge-logger.ts';

// Tables with user_id FK that get purged. DevAgent appends app-specific tables.
const PURGE_TABLES = [
  'push_tokens',
  'notifications',
  'user_bookmarks',
  'feedback',
  'consent_log',
  'credit_balances',
  'credit_ledger',
  'transactions',
  'cost_usage',
  'data_export_requests',
];

interface PurgePayload { userId: string; }

export async function handlePurgeAccount(
  raw: Record<string, unknown>,
): Promise<{ purged: boolean; userId: string }> {
  const { userId } = raw as unknown as PurgePayload;
if (!userId) throw new Error('purge_account: missing userId');

  const client = serviceClient();

  const tableResults = await Promise.all([
    ...PURGE_TABLES.map(async (table) => {
      const { error } = await client.from(table).delete().eq('user_id', userId);
      return { table, error };
    }),
    client.from('profiles').delete().eq('id', userId).then((r) => ({ table: 'profiles', error: r.error })),
  ]);
  const failed = tableResults.filter((r) => r.error);
  if (failed.length > 0) {
    const failedTables = failed.map((f) => f.table);
    log('error', 'purge-account', 'table_delete_failed', {
      userId,
      tables: failedTables,
      errors: failed.map((f) => String(f.error)),
    });
    // Fail the job so it retries — partial purge breaks GDPR erasure guarantees.
    throw new Error(`Purge failed for tables: ${failedTables.join(', ')}`);
  }

  // Audit log entry BEFORE deleting auth user — actor_id may be null after.
  await writeAuditLog({
    actorId: userId,
    actorType: 'system',
    action: 'account.purged',
    targetTable: 'auth.users',
    targetId: userId,
  });

  await client.from('account_deletion_log').insert({
    user_id: userId,
    event: 'purged',
  });

  // Delete auth user via admin API. If this fails, the job retries (data already purged but
  // user can still authenticate, which is the safer half of the failure).
  const { error: aErr } = await client.auth.admin.deleteUser(userId);
  if (aErr) {
    log('error', 'purge-account', 'auth_delete_failed', { userId, error: String(aErr) });
    throw new Error(`Auth user delete failed: ${String(aErr)}`);
  }

  log('info', 'purge-account', 'purged', { userId });
  return { purged: true, userId };
}