-- ─── push_tokens ─────────────────
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  device_id text,
  platform text not null check (platform in ('ios', 'android', 'web')),
  preferences jsonb not null default '{"transactional":true,"product":true,"marketing":false}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "users_read_own_push_tokens" on public.push_tokens;
create policy "users_read_own_push_tokens" on public.push_tokens for select to authenticated using (user_id = auth.uid());

drop policy if exists "users_insert_own_push_tokens" on public.push_tokens;
create policy "users_insert_own_push_tokens" on public.push_tokens for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "users_update_own_push_tokens" on public.push_tokens;
create policy "users_update_own_push_tokens" on public.push_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users_delete_own_push_tokens" on public.push_tokens;
create policy "users_delete_own_push_tokens" on public.push_tokens for delete to authenticated using (user_id = auth.uid());

drop policy if exists "service_role_write_push_tokens" on public.push_tokens;
create policy "service_role_write_push_tokens" on public.push_tokens for all to service_role using (true) with check (true);

-- ─── anonymous_migrations ─────────────────
create table if not exists public.anonymous_migrations (
  id uuid primary key default gen_random_uuid(),
  anon_user_id uuid not null,
  permanent_user_id uuid not null references auth.users(id) on delete cascade,
  table_rowcounts jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'completed', 'failed')) default 'pending',
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_anon_migrations_permanent on public.anonymous_migrations(permanent_user_id);

alter table public.anonymous_migrations enable row level security;

drop policy if exists "users_read_own_migrations" on public.anonymous_migrations;
create policy "users_read_own_migrations" on public.anonymous_migrations for select to authenticated using (permanent_user_id = auth.uid());

drop policy if exists "service_role_write_anon_migrations" on public.anonymous_migrations;
create policy "service_role_write_anon_migrations" on public.anonymous_migrations for all to service_role using (true) with check (true);
