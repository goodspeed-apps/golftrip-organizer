// supabase/functions/_shared/jobs.ts
// Enqueue helper, claim/complete/fail wrappers, and Job type.

import { serviceClient } from './edge-client.ts';

// Union of every job kind dispatched by job-worker. DevAgent appends app-
// specific kinds. Keep in sync with the `handlers` map in job-worker/index.ts.
export type JobKind =
  | 'send_push'
  | 'send_email'
  | 'dispatch_outbound_webhook'
  | 'enforce_retention'
  | 'purge_pending_deletions'
  | 'purge_account'
  | 'build_data_export'
  | 'oauth_refresh';

export interface Job {
  id: string;
  kind: JobKind | string;
  payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'dead';
  attempts: number;
  max_attempts: number;
  available_at: string;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueParams {
  kind: JobKind | string;
  payload?: Record<string, unknown>;
  availableAt?: Date;
  maxAttempts?: number;
}

export async function enqueueJob(p: EnqueueParams): Promise<{ id: string }> {
  const client = serviceClient();
  const { data, error } = await client.from('jobs').insert({
    kind: p.kind,
    payload: p.payload ?? {},
    available_at: (p.availableAt ?? new Date()).toISOString(),
    max_attempts: p.maxAttempts ?? 5,
  }).select('id').single();
  if (error) throw error;
  return { id: data.id };
}

export async function claimJobs(limit = 10, worker = 'edge'): Promise<Job[]> {
  const client = serviceClient();
  const { data, error } = await client.rpc('claim_jobs', { p_limit: limit, p_worker: worker });
  if (error) throw error;
  return (data ?? []) as Job[];
}

export async function completeJob(id: string, result: Record<string, unknown> = {}): Promise<void> {
  const client = serviceClient();
  const { error } = await client.rpc('complete_job', { p_id: id, p_result: result });
  if (error) throw error;
}

export async function failJob(id: string, errMsg: string): Promise<void> {
  const client = serviceClient();
  const { error } = await client.rpc('fail_job', { p_id: id, p_error: errMsg });
  if (error) throw error;
}