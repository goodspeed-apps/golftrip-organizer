-- GAS Template — Async Backbone Watchdog
-- Recovers jobs stuck in 'running' state past a stale-lock threshold.
-- Companion to migration 005. Scheduled via pg_cron in scripts/register-cron.sql.

-- Index covering the watchdog's filter to avoid full table scans at scale.
create index if not exists idx_jobs_watchdog
  on public.jobs (locked_at)
  where status = 'running';

-- recover_stale_jobs: any job in 'running' status with locked_at older than
-- p_stale_after is reset to 'pending' so the worker can re-claim it. Returns
-- the count of jobs reset.
--
-- Default stale_after of 10 minutes is well above the Edge Function wall-clock
-- cap (~150 seconds) but short enough to bound user-visible delay when a
-- worker crashes.
create or replace function public.recover_stale_jobs(
  p_stale_after interval default interval '10 minutes'
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  with reset as (
    update public.jobs
    set status = 'pending',
        locked_at = null,
        locked_by = null,
        last_error = coalesce(last_error || ' | ', '') || 'stale_lock_recovered',
        updated_at = now()
    where status = 'running'
      and locked_at is not null
      and locked_at < now() - p_stale_after
    returning id
  )
  select count(*) into v_count from reset;
  return v_count;
end;
$$;

revoke execute on function public.recover_stale_jobs(interval) from public, anon, authenticated;