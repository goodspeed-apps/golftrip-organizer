-- Resilience, versioning, release safety.
-- feature_flags (with kill_* namespace), app_versions for min-client-version gate.

-- ─── feature_flags ────────────────────────────────────────────────────────────

create table if not exists public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  rollout_percentage int not null default 100 check (rollout_percentage between 0 and 100),
  segments jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists "public_read_feature_flags" on public.feature_flags;
create policy "public_read_feature_flags"
  on public.feature_flags for select
  to authenticated, anon
  using (true);

drop policy if exists "service_role_write_feature_flags" on public.feature_flags;
create policy "service_role_write_feature_flags"
  on public.feature_flags for all
  to service_role
  using (true) with check (true);

create index if not exists idx_feature_flags_updated on public.feature_flags (updated_at desc);

-- ─── app_versions ─────────────────────────────────────────────────────────────

create table if not exists public.app_versions (
  platform text primary key check (platform in ('ios', 'android', 'web')),
  min_version text not null check (min_version ~ '^[0-9]+\.[0-9]+\.[0-9]+'),
  recommended_version text not null check (recommended_version ~ '^[0-9]+\.[0-9]+\.[0-9]+'),
  message text not null default 'A new version is available. Please update to continue.',
  updated_at timestamptz not null default now()
);

alter table public.app_versions enable row level security;

drop policy if exists "public_read_app_versions" on public.app_versions;
create policy "public_read_app_versions"
  on public.app_versions for select
  to authenticated, anon
  using (true);

drop policy if exists "service_role_write_app_versions" on public.app_versions;
create policy "service_role_write_app_versions"
  on public.app_versions for all
  to service_role
  using (true) with check (true);

insert into public.app_versions (platform, min_version, recommended_version) values
  ('ios', '1.0.0', '1.0.0'),
  ('android', '1.0.0', '1.0.0'),
  ('web', '1.0.0', '1.0.0')
on conflict (platform) do nothing;

-- ─── updated_at trigger ─────────────────────────────────────────────────────
-- Reuses public.set_updated_at() defined in migration 003.

drop trigger if exists trg_feature_flags_updated on public.feature_flags;
create trigger trg_feature_flags_updated
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

drop trigger if exists trg_app_versions_updated on public.app_versions;
create trigger trg_app_versions_updated
  before update on public.app_versions
  for each row execute function public.set_updated_at();
