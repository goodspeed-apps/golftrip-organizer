import { serviceClient } from '../_shared/edge-client.ts';
import { enqueueJob } from '../_shared/jobs.ts';
import { log } from '../_shared/edge-logger.ts';

export async function handlePurgePendingDeletions(
  _payload: Record<string, unknown>,
): Promise<{ enqueued: number }> {
  const client = serviceClient();
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .lte('delete_scheduled_for', new Date().toISOString());
  if (error) throw error;

  const rows = (data ?? []) as { id: string }[];
  await Promise.all(rows.map((row) =>
    enqueueJob({ kind: 'purge_account', payload: { userId: row.id } }),
  ));
  log('info', 'purge-pending-deletions', 'fanned_out', { enqueued: rows.length });
  return { enqueued: rows.length };
}