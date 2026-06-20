import { serviceClient } from './edge-client.ts';
import { log } from './edge-logger.ts';

interface Policy {
  table_name: string;
  column_name: string;
  ttl_interval: string;
  enabled: boolean;
}

export async function enforceRetention(): Promise<{ deleted: Record<string, number> }> {
  const client = serviceClient();
  const { data: policies, error: pErr } = await client
    .from('retention_policies')
    .select('table_name, column_name, ttl_interval, enabled')
    .eq('enabled', true);
  if (pErr) throw pErr;

const deleted: Record<string, number> = {};
  for (const policy of (policies ?? []) as Policy[]) {
    try {
      const count = await deleteExpired(client, policy);
      deleted[policy.table_name] = count;
    } catch (e) {
      log('warn', 'retention', 'policy_failed', {
        table: policy.table_name,
        error: e instanceof Error ? e.message : String(e),
      });
      deleted[policy.table_name] = -1;
    }
  }
  return { deleted };
}

async function deleteExpired(client: ReturnType<typeof serviceClient>, policy: Policy): Promise<number> {
  // Sentinel: ttl_interval='0' (or no parseable duration) with column_name='expires_at' means
  // "use the column as an absolute timestamp", delete where column < now().
  // Otherwise: delete where column < (now() - ttl_interval). Month/year are calendar-aware.
  const cutoff = computeCutoff(policy.ttl_interval);

  const { count, error } = await client
    .from(policy.table_name)
    .delete({ count: 'exact' })
    .lt(policy.column_name, cutoff.toISOString());
  if (error) throw error;
  return count ?? 0;
}

function computeCutoff(interval: string, now: Date = new Date()): Date {
  const m = interval.match(/^(\d+)\s+(second|minute|hour|day|month|year)s?$/);
  if (!m) return new Date(now);
  const n = Number(m[1]);
  const unit = m[2];
  const d = new Date(now);
  switch (unit) {
    case 'second': d.setUTCSeconds(d.getUTCSeconds() - n); break;
    case 'minute': d.setUTCMinutes(d.getUTCMinutes() - n); break;
    case 'hour': d.setUTCHours(d.getUTCHours() - n); break;
    case 'day': d.setUTCDate(d.getUTCDate() - n); break;
    case 'month': d.setUTCMonth(d.getUTCMonth() - n); break;
    case 'year': d.setUTCFullYear(d.getUTCFullYear() - n); break;
  }
  return d;
}