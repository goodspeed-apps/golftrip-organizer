-- Run ONCE per environment after deploying job-worker.
-- Replace {{SUPABASE_FUNCTIONS_URL}} and {{CRON_SECRET}} with real values
-- before executing (or use psql -v varname=value).
--
-- This schedules the job-worker to fire every minute.
-- Requires pg_cron and pg_net extensions (both created by migration 005).
--
-- AUTH (P7-7 / H-7): job-worker now requires `Authorization: Bearer <CRON_SECRET>`.
-- The previous `x-admin-key: <ADMIN_API_KEY>` header is no longer accepted.

select cron.schedule(
  'gas-job-worker',
  '* * * * *',
  $$
    select net.http_post(
      url := '{{SUPABASE_FUNCTIONS_URL}}/job-worker',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'Authorization', 'Bearer {{CRON_SECRET}}'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- To unschedule:
-- select cron.unschedule('gas-job-worker');

-- Watchdog: reset jobs stuck in 'running' past 10 minutes back to 'pending'.
-- Fires every 5 minutes (no need for per-minute granularity).
select cron.schedule(
  'gas-stale-lock-recovery',
  '*/5 * * * *',
  $$
    select public.recover_stale_jobs(interval '10 minutes');
  $$
);

-- To unschedule:
-- select cron.unschedule('gas-stale-lock-recovery');

-- Idempotency keys cleanup: delete rows past their expiry (set by webhook
-- receivers). Fires once an hour (no need for higher frequency).
select cron.schedule(
  'gas-idempotency-cleanup',
  '17 * * * *',
  $$
    select public.cleanup_idempotency_keys();
  $$
);

-- To unschedule:
-- select cron.unschedule('gas-idempotency-cleanup');

-- Retention engine: process retention_policies nightly at 03:19.
-- Runs via the job queue so the work is captured + retryable.
select cron.schedule(
  'gas-enforce-retention',
  '19 3 * * *',
  $$
    insert into public.jobs (kind, payload) values ('enforce_retention', '{}'::jsonb);
  $$
);

-- To unschedule:
-- select cron.unschedule('gas-enforce-retention');

-- Account deletion: daily at 04:23 enqueue a fanout job that scans for
-- profiles with delete_scheduled_for <= now() and enqueues per-user
-- purge_account jobs.
select cron.schedule(
  'gas-purge-pending-deletions',
  '23 4 * * *',
  $$
    insert into public.jobs (kind, payload) values ('purge_pending_deletions', '{}'::jsonb);
  $$
);

-- To unschedule:
-- select cron.unschedule('gas-purge-pending-deletions');
