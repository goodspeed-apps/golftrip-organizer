-- ─── profiles.role column ─────────────────────────────────────────────────────
-- Must precede the admin RLS policies below: the feedback_threads /
-- feedback_messages admin policies reference profiles.role, and CREATE POLICY
-- validates column references at creation time, so the column must exist first.

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'admin'));

create index if not exists idx_profiles_role on public.profiles (role) where role = 'admin';

-- ─── organizations + organization_members tables ─────────────────────────────

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- SECURITY DEFINER lookup bypasses RLS so policies on organization_members can
-- self-reference without triggering 42P17 infinite recursion.
create or replace function public.user_org_ids(p_user uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select organization_id from public.organization_members where user_id = p_user;
$$;

revoke execute on function public.user_org_ids(uuid) from public, anon;
grant execute on function public.user_org_ids(uuid) to authenticated, service_role;

alter table public.organizations enable row level security;

drop policy if exists "members_read_organizations" on public.organizations;
create policy "members_read_organizations"
  on public.organizations for select
  to authenticated
  using (id in (select public.user_org_ids(auth.uid())));

drop policy if exists "owners_update_organizations" on public.organizations;
create policy "owners_update_organizations"
  on public.organizations for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "service_role_write_organizations" on public.organizations;
create policy "service_role_write_organizations"
  on public.organizations for all
  to service_role
  using (true) with check (true);

drop trigger if exists trg_organizations_updated on public.organizations;
create trigger trg_organizations_updated
  before update on public.organizations
  for each row execute function public.set_updated_at();

alter table public.organization_members enable row level security;

drop policy if exists "members_read_membership" on public.organization_members;
create policy "members_read_membership"
  on public.organization_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or organization_id in (select public.user_org_ids(auth.uid()))
  );

drop policy if exists "service_role_write_organization_members" on public.organization_members;
create policy "service_role_write_organization_members"
  on public.organization_members for all
  to service_role
  using (true) with check (true);

create index if not exists idx_organization_members_user on public.organization_members (user_id);

-- ─── referrals ────────────────────────────────────────────────────────────────

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  attribution_event text,
  attributed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

drop policy if exists "users_read_own_referrals" on public.referrals;
create policy "users_read_own_referrals"
  on public.referrals for select
  to authenticated
  using (referrer_user_id = auth.uid() or referred_user_id = auth.uid());

drop policy if exists "service_role_write_referrals" on public.referrals;
create policy "service_role_write_referrals"
  on public.referrals for all
  to service_role
  using (true) with check (true);

create index if not exists idx_referrals_referrer on public.referrals (referrer_user_id, created_at desc);
create index if not exists idx_referrals_code on public.referrals (code);

-- ─── feedback_threads + feedback_messages ─────────────────────────────────────

create table if not exists public.feedback_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'pending_user', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feedback_threads enable row level security;

drop policy if exists "users_read_own_feedback_threads" on public.feedback_threads;
create policy "users_read_own_feedback_threads"
  on public.feedback_threads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "users_create_own_feedback_threads" on public.feedback_threads;
create policy "users_create_own_feedback_threads"
  on public.feedback_threads for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "admins_read_all_feedback_threads" on public.feedback_threads;
create policy "admins_read_all_feedback_threads"
  on public.feedback_threads for select
  to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "admins_update_feedback_threads" on public.feedback_threads;
create policy "admins_update_feedback_threads"
  on public.feedback_threads for update
  to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "service_role_write_feedback_threads" on public.feedback_threads;
create policy "service_role_write_feedback_threads"
  on public.feedback_threads for all
  to service_role
  using (true) with check (true);

drop trigger if exists trg_feedback_threads_updated on public.feedback_threads;
create trigger trg_feedback_threads_updated
  before update on public.feedback_threads
  for each row execute function public.set_updated_at();

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.feedback_threads(id) on delete cascade,
  author_role text not null check (author_role in ('user', 'admin')),
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback_messages enable row level security;

drop policy if exists "users_read_own_thread_messages" on public.feedback_messages;
create policy "users_read_own_thread_messages"
  on public.feedback_messages for select
  to authenticated
  using (
    thread_id in (
      select id from public.feedback_threads where user_id = auth.uid()
    )
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "users_post_own_thread_messages" on public.feedback_messages;
create policy "users_post_own_thread_messages"
  on public.feedback_messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      thread_id in (select id from public.feedback_threads where user_id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

drop policy if exists "service_role_write_feedback_messages" on public.feedback_messages;
create policy "service_role_write_feedback_messages"
  on public.feedback_messages for all
  to service_role
  using (true) with check (true);

create index if not exists idx_feedback_messages_thread on public.feedback_messages (thread_id, created_at);

-- ─── experiments ──────────────────────────────────────────────────────────────

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_name text not null,
  variant text not null,
  assigned_at timestamptz not null default now(),
  unique (user_id, experiment_name)
);

alter table public.experiments enable row level security;

drop policy if exists "users_read_own_experiments" on public.experiments;
create policy "users_read_own_experiments"
  on public.experiments for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "service_role_write_experiments" on public.experiments;
create policy "service_role_write_experiments"
  on public.experiments for all
  to service_role
  using (true) with check (true);

create index if not exists idx_experiments_user_name on public.experiments (user_id, experiment_name);
