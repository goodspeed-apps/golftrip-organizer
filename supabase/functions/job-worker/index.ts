// supabase/functions/job-worker/index.ts
// Claims up to 10 pending jobs and dispatches each to a handler keyed by kind.
// Invoked by pg_cron every minute (registered post-deploy; see supabase/functions/README.md).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { requireCronBearer } from '../_shared/edge-auth.ts';
import { claimJobs, completeJob, failJob, Job } from '../_shared/jobs.ts';
import { log, reportException } from '../_shared/edge-logger.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { handleSendPush } from '../send_push/handler.ts';
import { handleSendEmail } from '../send-email/handler.ts';
import { handleDispatchOutboundWebhook } from '../dispatch-outbound-webhook/handler.ts';
import { handleEnforceRetention } from '../enforce-retention/handler.ts';
import { handlePurgePendingDeletions } from '../purge-pending-deletions/handler.ts';
import { handlePurgeAccount } from '../purge-account/handler.ts';
import { handleBuildDataExport } from '../build-data-export/handler.ts';
import { handleOauthRefresh } from '../oauth-refresh/handler.ts';

// NOTE: job-worker is invoked by pg_cron (see scripts/register-cron.sql).
// pg_cron is a server-to-server caller with no user JWT. The caller MUST
// send `Authorization: Bearer <CRON_SECRET>` — the gate uses a constant-time
// compare against CRON_SECRET via requireCronBearer (see _shared/edge-auth.ts).
// Human-admin endpoints continue to use requireAdminJwt.

type Handler = (
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<Record<string, unknown>>;

const handlers: Record<string, Handler> = {
  send_push: handleSendPush,
  send_email: handleSendEmail,
  dispatch_outbound_webhook: handleDispatchOutboundWebhook,
  enforce_retention: handleEnforceRetention,
  purge_pending_deletions: handlePurgePendingDeletions,
  purge_account: handlePurgeAccount,
  build_data_export: handleBuildDataExport,
  oauth_refresh: handleOauthRefresh,
};

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const denied = requireCronBearer(req);
  if (denied) return denied;

  try {
    const jobs = await claimJobs(10, 'job-worker');
    log('info', 'job-worker', 'claimed', { count: jobs.length });

    const results = await Promise.all(jobs.map((j) => runOne(j)));
    return json({ processed: results.length, results });
  } catch (e) {
    reportException('job-worker', e);
    return err(String(e), 500, 'worker_error');
  }
});

async function runOne(job: Job): Promise<{ id: string; status: 'succeeded' | 'failed' }> {
  const handler = handlers[job.kind];
  if (!handler) {
    // Unknown kind: mark dead immediately, bypassing fail_job's attempts counter.
    // This is intentional — an unknown kind isn't a retryable failure, it's a misconfiguration.
    const c = serviceClient();
    const { error: updateErr } = await c.from('jobs').update({
      status: 'dead',
      last_error: `unknown_kind: ${job.kind}`,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    if (updateErr) {
      reportException('job-worker', updateErr, { jobId: job.id, kind: job.kind, stage: 'unknown_kind_dead' });
    } else {
      log('warn', 'job-worker', 'unknown_kind_dead', { id: job.id, kind: job.kind });
    }
    return { id: job.id, status: 'failed' };
  }
const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('handler_timeout')), 45_000);
  try {
    const result = await handler(job.payload, ac.signal);
    await completeJob(job.id, result);
    return { id: job.id, status: 'succeeded' };
  } catch (e) {
    const msg = e instanceof Error
      ? (ac.signal.aborted ? `timeout_after_45s: ${e.message}` : e.message)
      : String(e);
    await failJob(job.id, msg);
    reportException('job-worker', e, { jobId: job.id, kind: job.kind, aborted: ac.signal.aborted });
    return { id: job.id, status: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}
