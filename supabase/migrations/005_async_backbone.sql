-- Async backbone: jobs, rate limits, idempotency, webhooks (in/out), email log.

-- wrap pg_cron creation so it doesn't abort the migration on
-- managed Supabase projects where the extension requires dashboard opt-in.
do $$
begin
  create extension if not exists pg_cron;
exception when insufficient_privilege then
  raise notice 'pg_cron requires superuser; enable via Supabase dashboard (Database > Extensions). Skipping for now.';
end $$;

-- ─── Jobs queue ────────────────────────────────────────────────────────────────
-- Each row is one unit of async work. The job-worker Edge Function claims rows
-- atomically via claim_jobs(), executes them, and updates status.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs enable row level security;

-- idempotent policy for jobs
drop policy if exists "service_role_only_jobs" on public.jobs;
create policy "service_role_only_jobs"
  on public.jobs for all
  to service_role
  using (true) with check (true);

create index if not exists idx_jobs_claim
  on public.jobs (status, available_at)
  where status = 'pending';

create index if not exists idx_jobs_kind_status
  on public.jobs (kind, status);

create or replace function public.claim_jobs(
  p_limit integer default 10,
  p_worker text default 'edge'
)
returns setof public.jobs
language plpgsql
security definer
as $$
begin
  return query
  with claimed as (
    select id from public.jobs
    where status = 'pending' and available_at <= now()
    order by available_at asc
    limit p_limit
    for update skip locked
  )
  update public.jobs j
    set status = 'running',
        locked_at = now(),
        locked_by = p_worker,
        attempts = attempts + 1,
        updated_at = now()
  from claimed
  where j.id = claimed.id
  returning j.*;
end;
$$;

-- revoke execute on claim_jobs from public/anon/authenticated
revoke execute on function public.claim_jobs(integer, text) from public, anon, authenticated;

create or replace function public.complete_job(
  p_id uuid,
  p_result jsonb default '{}'
)
returns void
language plpgsql
security definer
as $$
begin
  update public.jobs
  set status = 'succeeded',
      result = p_result,
      last_error = null,
      locked_at = null,
      locked_by = null,
      updated_at = now()
  where id = p_id;
end;
$$;

-- revoke execute on complete_job from public/anon/authenticated
revoke execute on function public.complete_job(uuid, jsonb) from public, anon, authenticated;

create or replace function public.fail_job(
  p_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
as $$
declare
  v_row public.jobs%rowtype;
  v_backoff_seconds integer;
begin
  -- select for update to prevent concurrent re-queue races
  select * into v_row from public.jobs where id = p_id for update;
  if v_row.attempts >= v_row.max_attempts then
    update public.jobs
    set status = 'dead',
        last_error = p_error,
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = p_id;
  else
    -- cap exponent at 20 and use bigint intermediate to prevent int overflow
    v_backoff_seconds := least(3600, (power(2, least(v_row.attempts, 20))::bigint * 30)::integer);
    update public.jobs
    set status = 'pending',
        last_error = p_error,
        available_at = now() + (v_backoff_seconds || ' seconds')::interval,
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = p_id;
  end if;
end;
$$;

-- revoke execute on fail_job from public/anon/authenticated
revoke execute on function public.fail_job(uuid, text) from public, anon, authenticated;

-- ─── Rate limit buckets ────────────────────────────────────────────────────────

create table if not exists public.rate_limits (
  scope text not null,
  key text not null,
  tokens double precision not null,
  capacity double precision not null,
  refill_per_second double precision not null,
  updated_at timestamptz not null default now(),
  primary key (scope, key)
);

alter table public.rate_limits enable row level security;

-- idempotent policy for rate_limits
drop policy if exists "service_role_only_rate_limits" on public.rate_limits;
create policy "service_role_only_rate_limits"
  on public.rate_limits for all
  to service_role
  using (true) with check (true);

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key text,
  p_capacity double precision,
  p_refill_per_second double precision,
  p_cost double precision default 1.0
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_tokens double precision;
  v_updated timestamptz;
  v_now timestamptz := now();
  v_elapsed double precision;
begin
  select tokens, updated_at into v_tokens, v_updated
  from public.rate_limits
  where scope = p_scope and key = p_key
  for update;

  if not found then
    -- return false immediately when cost exceeds capacity
    if p_cost > p_capacity then
      return false;
    end if;
    insert into public.rate_limits (scope, key, tokens, capacity, refill_per_second, updated_at)
    values (p_scope, p_key, greatest(0, p_capacity - p_cost), p_capacity, p_refill_per_second, v_now);
    return true;
  end if;

  v_elapsed := extract(epoch from (v_now - v_updated));
  v_tokens := least(p_capacity, v_tokens + v_elapsed * p_refill_per_second);

  if v_tokens < p_cost then
    update public.rate_limits
    set tokens = v_tokens, updated_at = v_now
    where scope = p_scope and key = p_key;
    return false;
  end if;

  update public.rate_limits
  set tokens = v_tokens - p_cost,
      capacity = p_capacity,
      refill_per_second = p_refill_per_second,
      updated_at = v_now
  where scope = p_scope and key = p_key;
  return true;
end;
$$;

-- revoke execute on consume_rate_limit from public/anon/authenticated
revoke execute on function public.consume_rate_limit(text, text, double precision, double precision, double precision) from public, anon, authenticated;

-- ─── Idempotency keys ──────────────────────────────────────────────────────────

create table if not exists public.idempotency_keys (
  scope text not null,
  key text not null,
  result jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (scope, key)
);

alter table public.idempotency_keys enable row level security;

-- idempotent policy for idempotency_keys
drop policy if exists "service_role_only_idempotency" on public.idempotency_keys;
create policy "service_role_only_idempotency"
  on public.idempotency_keys for all
  to service_role
  using (true) with check (true);

-- ─── Outbound webhooks ─────────────────────────────────────────────────────────

create table if not exists public.webhooks_out (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  url text not null,
  method text not null default 'POST',
  headers jsonb not null default '{}',
  body jsonb not null default '{}',
  secret text,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'failed', 'dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  response_status integer,
  response_body text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

alter table public.webhooks_out enable row level security;

-- idempotent policy for webhooks_out
drop policy if exists "service_role_only_webhooks_out" on public.webhooks_out;
create policy "service_role_only_webhooks_out"
  on public.webhooks_out for all
  to service_role
  using (true) with check (true);

create index if not exists idx_webhooks_out_user
  on public.webhooks_out (user_id);

-- partial index for outbound webhook dispatcher poll
create index if not exists idx_webhooks_out_dispatch
  on public.webhooks_out (status, created_at)
  where status = 'pending';

-- ─── Email log ─────────────────────────────────────────────────────────────────

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  template text not null,
  to_address text not null,
  subject text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  resend_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.email_log enable row level security;

-- idempotent policy for email_log
drop policy if exists "service_role_only_email_log" on public.email_log;
create policy "service_role_only_email_log"
  on public.email_log for all
  to service_role
  using (true) with check (true);

create index if not exists idx_email_log_user on public.email_log (user_id);
create index if not exists idx_email_log_template on public.email_log (template);

-- ─── pg_net (required for pg_cron http calls in scripts/register-cron.sql) ───
