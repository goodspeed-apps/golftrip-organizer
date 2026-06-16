-- Media, search, realtime, integrations.
-- oauth_connections (encrypted at rest), encrypt/decrypt RPCs, search_with_rank helper.

-- pgcrypto is required for pgp_sym_encrypt / pgp_sym_decrypt.
create extension if not exists pgcrypto;

-- ─── oauth_connections ────────────────────────────────────────────────────────

create table if not exists public.oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token_encrypted bytea not null,
  refresh_token_encrypted bytea,
  expires_at timestamptz,
  scope text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.oauth_connections enable row level security;

drop policy if exists "users_read_own_oauth_connections" on public.oauth_connections;
create policy "users_read_own_oauth_connections"
  on public.oauth_connections for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "service_role_write_oauth_connections" on public.oauth_connections;
create policy "service_role_write_oauth_connections"
  on public.oauth_connections for all
  to service_role
  using (true) with check (true);

create index if not exists idx_oauth_connections_user_provider
  on public.oauth_connections (user_id, provider);

drop trigger if exists trg_oauth_connections_updated on public.oauth_connections;
create trigger trg_oauth_connections_updated
  before update on public.oauth_connections
  for each row execute function public.set_updated_at();

-- ─── Encryption helpers ───────────────────────────────────────────────────────
-- The key is passed inline on every call. PostgREST pools transactions so a
-- transaction-local GUC set in one client.rpc() call is not visible to the
-- next call — the key MUST travel with each invocation.
-- Edge functions read OAUTH_ENCRYPTION_KEY from env and forward it as p_key.

create or replace function public.encrypt_oauth_token(p_plaintext text, p_key text)
returns bytea
language plpgsql
security definer
as $$
begin
  if p_key is null or p_key = '' then
    raise exception 'OAUTH_ENCRYPTION_KEY required';
  end if;
  return pgp_sym_encrypt(p_plaintext, p_key);
end;
$$;

revoke execute on function public.encrypt_oauth_token(text, text) from public, anon, authenticated;
grant execute on function public.encrypt_oauth_token(text, text) to service_role;

create or replace function public.decrypt_oauth_token(p_ciphertext bytea, p_key text)
returns text
language plpgsql
security definer
as $$
begin
  if p_key is null or p_key = '' then
    raise exception 'OAUTH_ENCRYPTION_KEY required';
  end if;
  return pgp_sym_decrypt(p_ciphertext, p_key);
end;
$$;

revoke execute on function public.decrypt_oauth_token(bytea, text) from public, anon, authenticated;
grant execute on function public.decrypt_oauth_token(bytea, text) to service_role;

-- ─── FTS: search_with_rank ────────────────────────────────────────────────────
-- Operator adds `tsv tsvector generated always as (to_tsvector('english', ...)) stored`
-- and `searchable_text text generated always as (coalesce(<columns>, '')) stored`
-- plus a `using gin (tsv)` index on each searchable table.

create or replace function public.search_with_rank(
  p_table regclass,
  p_query text,
  p_limit int default 20,
  p_offset int default 0
)
returns table (id uuid, rank real, snippet text)
language plpgsql
stable
as $$
declare
  v_ts_query tsquery;
begin
  v_ts_query := websearch_to_tsquery('english', p_query);
  return query execute format(
    'select id, ts_rank(tsv, $1) as rank, '
    || 'ts_headline(''english'', coalesce(searchable_text, ''''), $1, '
    || '''MaxFragments=2, MinWords=5, MaxWords=12'') as snippet '
    || 'from %s where tsv @@ $1 order by rank desc limit $2 offset $3',
    p_table::text
  ) using v_ts_query, p_limit, p_offset;
end;
$$;

revoke execute on function public.search_with_rank(regclass, text, int, int) from public;
grant execute on function public.search_with_rank(regclass, text, int, int) to authenticated, service_role;

-- Variant that returns the joined row as jsonb in the same round-trip.
-- Used by services/search.ts when no narrow column subset is specified.
create or replace function public.search_with_rank_jsonb(
  p_table regclass,
  p_query text,
  p_limit int default 20,
  p_offset int default 0
)
returns table (id uuid, rank real, snippet text, "row" jsonb)
language plpgsql
stable
as $$
declare
  v_ts_query tsquery;
begin
  v_ts_query := websearch_to_tsquery('english', p_query);
  return query execute format(
    'select t.id, ts_rank(t.tsv, $1) as rank, '
    || 'ts_headline(''english'', coalesce(t.searchable_text, ''''), $1, '
    || '''MaxFragments=2, MinWords=5, MaxWords=12'') as snippet, '
    || 'to_jsonb(t.*) as "row" '
    || 'from %s t where t.tsv @@ $1 order by rank desc limit $2 offset $3',
    p_table::text
  ) using v_ts_query, p_limit, p_offset;
end;
$$;

revoke execute on function public.search_with_rank_jsonb(regclass, text, int, int) from public;
grant execute on function public.search_with_rank_jsonb(regclass, text, int, int) to authenticated, service_role;

-- ─── Storage bucket setup note ────────────────────────────────────────────────
-- Buckets are managed via the Storage API, not SQL. Recommended buckets:
--   avatars      — public read, auth user write to own folder
--   attachments  — auth user read+write to own folder
--   private      — service_role only
-- See scripts/setup-storage-buckets.sql for the per-bucket RLS policy DDL.

-- ─── oauth_refresh job dedupe ────────────────────────────────────────────────
-- Partial unique index ensures two concurrent enqueues for the same
-- (userId, provider) oauth_refresh target cannot both succeed. The edge
-- function (supabase/functions/oauth-get-token/index.ts) swallows the 23505
-- unique-violation that this index raises and treats it as "already enqueued".
create unique index if not exists idx_jobs_oauth_refresh_pending
  on public.jobs (kind, (payload->>'userId'), (payload->>'provider'))
  where kind = 'oauth_refresh' and status in ('pending', 'running');
