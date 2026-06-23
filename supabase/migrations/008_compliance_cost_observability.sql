-- Compliance + cost + observability schema.
-- Audit log, account deletion lifecycle, cost budgets/usage, retention policies, data export tracking.

-- ─── Audit log ─────────────────────────────────────────────────────────────────

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  actor_type text not null check (actor_type in ('user', 'admin', 'system', 'service_role')),
  action text not null,
  target_table text,
  target_id text,
  target_data jsonb,
  pii_class text not null default 'standard' check (pii_class in ('standard', 'phi', 'highly_sensitive')),
  ip_address inet,
  user_agent text,
  request_id text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists "service_role_only_audit_log" on public.audit_log;
create policy "service_role_only_audit_log"
  on public.audit_log for all
  to service_role
  using (true) with check (true);

create index if not exists idx_audit_log_actor on public.audit_log (actor_id, created_at desc);
create index if not exists idx_audit_log_target on public.audit_log (target_table, target_id, created_at desc);
create index if not exists idx_audit_log_action on public.audit_log (action, created_at desc);
create index if not exists idx_audit_log_pii
  on public.audit_log (pii_class, created_at desc)
  where pii_class != 'standard';

-- Reusable audit trigger function. Attach per-table via:
--   create trigger <name> after insert or update or delete on <table>
--   for each row execute function public.audit_trigger();
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  v_actor uuid;
  v_actor_type text;
  v_action text;
  v_target_id text;
  v_target_data jsonb;
  -- Declared in the OUTER block: these are referenced below in the IF and the
  -- v_actor_type CASE. A nested DECLARE would scope them to the inner block
  -- only, and PL/pgSQL would throw `column "v_actor_guc" does not exist` at
  -- runtime when the trigger fires (e.g. on the profile insert during signup,
  -- surfacing as Supabase's "Database error creating new user").
  v_actor_guc text;
  v_actor_type_guc text;
begin
-- Preferred path: edge functions call set_actor_context(user_id, 'user'|'admin')
  -- which writes the user's id into the per-transaction GUC request.actor_id and
  -- request.actor_type. This makes service-role writes initiated by a user still
  -- attribute correctly. Fallback: auth.uid() (set by Supabase when the client
  -- uses a user JWT directly). Final fallback: 'service_role' (cron, raw DB).
  begin
    v_actor_guc := current_setting('request.actor_id', true);
    v_actor_type_guc := current_setting('request.actor_type', true);
  exception when others then
    v_actor_guc := null;
    v_actor_type_guc := null;
  end;

  if v_actor_guc is not null and v_actor_guc <> '' then
    begin
      v_actor := v_actor_guc::uuid;
    exception when invalid_text_representation then
      v_actor := null;
    end;
  else
    begin
      v_actor := auth.uid();
    exception when others then
      v_actor := null;
    end;
  end if;

  v_actor_type := case
    when v_actor_type_guc is not null and v_actor_type_guc <> '' then v_actor_type_guc
    when v_actor is not null then 'user'
    else 'service_role'
  end;
  v_action := tg_table_name || '.' || lower(tg_op);
  if tg_op = 'DELETE' then
    v_target_id := coalesce(old.id::text, '');
    v_target_data := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    v_target_id := coalesce(new.id::text, '');
    v_target_data := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  else
    v_target_id := coalesce(new.id::text, '');
    v_target_data := to_jsonb(new);
  end if;
  insert into public.audit_log (actor_id, actor_type, action, target_table, target_id, target_data)
  values (v_actor, v_actor_type, v_action, tg_table_name, v_target_id, v_target_data);
  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_trigger() from public, anon, authenticated;

-- Per-transaction GUC setter used by edge functions to attribute audit_log rows
-- to the originating user/admin even when the DB call runs under service_role.
-- Use with SELECT set_actor_context(user_id, 'user'|'admin'); the values are
-- transaction-local (set_config(..., true)) so they don't leak between calls
-- on a pooled connection.
create or replace function public.set_actor_context(
  p_actor_id uuid,
  p_actor_type text default 'user'
) returns void
language sql
as $$
  select set_config('request.actor_id', coalesce(p_actor_id::text, ''), true),
         set_config('request.actor_type', p_actor_type, true);
$$;

grant execute on function public.set_actor_context(uuid, text) to service_role;

-- Attach trigger to template's default sensitive tables.
drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_credit_ledger on public.credit_ledger;
create trigger trg_audit_credit_ledger
  after insert or update or delete on public.credit_ledger
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_credit_balances on public.credit_balances;
create trigger trg_audit_credit_balances
  after insert or update or delete on public.credit_balances
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_transactions on public.transactions;
create trigger trg_audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_push_tokens on public.push_tokens;
create trigger trg_audit_push_tokens
  after insert or update or delete on public.push_tokens
  for each row execute function public.audit_trigger();

-- ─── Account deletion lifecycle ───────────────────────────────────────────────

alter table public.profiles add column if not exists pending_deletion_at timestamptz;
alter table public.profiles add column if not exists delete_scheduled_for timestamptz;
alter table public.profiles add column if not exists data_export_consent boolean not null default true;

create table if not exists public.account_deletion_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event text not null check (event in ('requested', 'cancelled', 'purged')),
  scheduled_for timestamptz,
  reason text,
  immediate boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.account_deletion_log enable row level security;

drop policy if exists "service_role_only_account_deletion_log" on public.account_deletion_log;
create policy "service_role_only_account_deletion_log"
  on public.account_deletion_log for all
  to service_role
  using (true) with check (true);

create index if not exists idx_account_deletion_log_user on public.account_deletion_log (user_id, created_at desc);

drop trigger if exists trg_audit_account_deletion_log on public.account_deletion_log;
create trigger trg_audit_account_deletion_log
  after insert on public.account_deletion_log
  for each row execute function public.audit_trigger();

-- ─── Cost budgets and usage ───────────────────────────────────────────────────

create table if not exists public.cost_budgets (
  scope text not null,
  key text not null,
  period text not null check (period in ('hour', 'day', 'month')),
  cost_limit numeric not null,
  enforcement text not null default 'throttle' check (enforcement in ('throttle', 'block', 'alert_only')),
  throttle_capacity numeric,
  throttle_refill_per_second numeric,
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (scope, key, period)
);

alter table public.cost_budgets enable row level security;

drop policy if exists "service_role_only_cost_budgets" on public.cost_budgets;
create policy "service_role_only_cost_budgets"
  on public.cost_budgets for all
  to service_role
  using (true) with check (true);

create table if not exists public.cost_usage (
  id bigserial primary key,
  scope text not null,
  key text not null,
  cost numeric not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.cost_usage enable row level security;

drop policy if exists "service_role_only_cost_usage" on public.cost_usage;
create policy "service_role_only_cost_usage"
  on public.cost_usage for all
  to service_role
  using (true) with check (true);

create index if not exists idx_cost_usage_window on public.cost_usage (scope, key, created_at desc);

-- Note: omit the "hot path" partial index using `now()` in the WHERE clause:
-- Postgres does not allow non-immutable functions in partial-index predicates.
-- The `idx_cost_usage_window` index covers the common access pattern.

-- consume_cost: atomic check-and-record for cost budgets.
-- Returns jsonb with allowed, remaining, reset_at, enforcement, throttled.
create or replace function public.consume_cost(
  p_scope text,
  p_key text,
  p_cost numeric,
  p_period text default 'day'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_budget public.cost_budgets%rowtype;
  v_sum numeric;
  v_remaining numeric;
  v_reset_at timestamptz;
  v_throttle_ok boolean;
  v_window_start timestamptz;
begin
  -- Serialize concurrent consume_cost calls for the same (scope,key,period)
  -- via an advisory lock keyed on the budget identity. Cheaper than a row
  -- lock that would block other reads, and bounded to the actual decision.
  perform pg_advisory_xact_lock(hashtext(p_scope || ':' || p_key || ':' || p_period));

  select * into v_budget
  from public.cost_budgets
  where scope = p_scope and key = p_key and period = p_period;

  if not found then
    -- No cap configured; allow and don't record.
    return jsonb_build_object(
      'allowed', true,
      'remaining', null,
      'reset_at', null,
      'enforcement', null,
      'throttled', false
    );
  end if;

  v_window_start := case p_period
    when 'hour' then date_trunc('hour', now())
    when 'day' then date_trunc('day', now())
    when 'month' then date_trunc('month', now())
  end;
  v_reset_at := case p_period
    when 'hour' then v_window_start + interval '1 hour'
    when 'day' then v_window_start + interval '1 day'
    when 'month' then v_window_start + interval '1 month'
  end;

  select coalesce(sum(cost), 0) into v_sum
  from public.cost_usage
  where scope = p_scope and key = p_key and created_at >= v_window_start;

  v_remaining := v_budget.cost_limit - v_sum;

  if v_sum + p_cost <= v_budget.cost_limit then
    insert into public.cost_usage (scope, key, cost) values (p_scope, p_key, p_cost);
    return jsonb_build_object(
      'allowed', true,
      'remaining', v_remaining - p_cost,
      'reset_at', v_reset_at,
      'enforcement', v_budget.enforcement,
      'throttled', false
    );
  end if;

  if v_budget.enforcement = 'block' then
    return jsonb_build_object(
      'allowed', false,
      'remaining', greatest(v_remaining, 0),
      'reset_at', v_reset_at,
      'enforcement', 'block',
      'throttled', false
    );
  end if;

  if v_budget.enforcement = 'throttle' then
    if v_budget.throttle_capacity is null or v_budget.throttle_refill_per_second is null then
      return jsonb_build_object(
        'allowed', false,
        'remaining', greatest(v_remaining, 0),
        'reset_at', v_reset_at,
        'enforcement', 'throttle',
        'throttled', false
      );
    end if;
    v_throttle_ok := public.consume_rate_limit(
      p_scope,
      p_key,
      v_budget.throttle_capacity,
      v_budget.throttle_refill_per_second,
      1.0
    );
    if v_throttle_ok then
      insert into public.cost_usage (scope, key, cost, metadata)
      values (p_scope, p_key, p_cost, jsonb_build_object('throttled', true));
      return jsonb_build_object(
        'allowed', true,
        'remaining', 0,
        'reset_at', v_reset_at,
        'enforcement', 'throttle',
        'throttled', true
      );
    end if;
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', v_reset_at,
      'enforcement', 'throttle',
      'throttled', true
    );
  end if;

  -- alert_only: record and allow, emit an audit event.
  insert into public.cost_usage (scope, key, cost, metadata)
  values (p_scope, p_key, p_cost, jsonb_build_object('over_cap', true));
  -- Second audit write site (cost_budgets has no audit_trigger). If audit_log
  -- schema grows mandatory columns later, update both this insert and audit_trigger().
insert into public.audit_log (actor_id, actor_type, action, target_table, target_id, target_data)
  values (
    case when p_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_key::uuid else null end,
    'system',
    'cost.cap_exceeded_alert_only',
    'cost_budgets',
    p_scope || ':' || p_key || ':' || p_period,
    jsonb_build_object('cost', p_cost, 'over_by', (v_sum + p_cost) - v_budget.cost_limit)
  );
  return jsonb_build_object(
    'allowed', true,
    'remaining', v_remaining - p_cost,
    'reset_at', v_reset_at,
    'enforcement', 'alert_only',
    'throttled', false
  );
end;
$$;

revoke execute on function public.consume_cost(text, text, numeric, text) from public, anon, authenticated;

-- ─── Retention policies ───────────────────────────────────────────────────────

create table if not exists public.retention_policies (
  table_name text not null,
  column_name text not null default 'created_at',
  ttl_interval interval not null,
  enabled boolean not null default true,
  metadata jsonb not null default '{}',
  primary key (table_name, column_name)
);

alter table public.retention_policies enable row level security;

drop policy if exists "service_role_only_retention_policies" on public.retention_policies;
create policy "service_role_only_retention_policies"
  on public.retention_policies for all
  to service_role
  using (true) with check (true);

insert into public.retention_policies (table_name, column_name, ttl_interval, enabled, metadata) values
  ('idempotency_keys', 'expires_at', interval '0 days', true, jsonb_build_object('note', 'expires_at-driven; ttl_interval=0 means engine should DELETE WHERE expires_at < now() rather than created_at < now() - ttl_interval. Engine must special-case ttl_interval=0 with column_name=expires_at.')),
  ('audit_log', 'created_at', interval '365 days', true, jsonb_build_object('note', 'SOC 2 norm; HIPAA overlay extends to 6 years')),
  ('cost_usage', 'created_at', interval '90 days', true, '{}'),
  ('account_deletion_log', 'created_at', interval '7 years', true, jsonb_build_object('note', 'legal hold for compliance audit')),
  ('data_export_requests', 'created_at', interval '30 days', true, jsonb_build_object('note', 'storage_path signed URL TTL is 7d; row TTL is 30d for audit'))
on conflict (table_name, column_name) do nothing;

-- ─── Data export tracking ─────────────────────────────────────────────────────

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'expired')),
  storage_path text,
  -- download_url intentionally NOT stored: a signed URL is a bearer token. Anyone
  -- with read access (admins, support) could grab another user's export until TTL
  -- expires. Always regenerate on demand via createSignedUrl(storage_path).
  expires_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.data_export_requests enable row level security;

drop policy if exists "service_role_only_data_export_requests" on public.data_export_requests;
create policy "service_role_only_data_export_requests"
  on public.data_export_requests for all
  to service_role
  using (true) with check (true);

create index if not exists idx_data_export_requests_user on public.data_export_requests (user_id, created_at desc);
