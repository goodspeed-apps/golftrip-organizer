-- GAS Template — Base Schema
-- This migration creates the tables common to ALL apps.
-- The DevAgent adds app-specific tables in 002_app_schema.sql.

-- ─── Profiles (extends auth.users) ────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free',
  revenuecat_customer_id text,
  trial_ends_at timestamptz,
  onboarding_completed boolean not null default false,
  notification_preferences jsonb not null default '{}',
  theme_preference text not null default 'system',
  biometric_auth_enabled boolean not null default false,
  push_token text,
  streak_count integer not null default 0,
  last_active_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Push Tokens ──────────────────────────────────────────────────────────────

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  unique(user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "Users can manage own push tokens"
  on public.push_tokens for all
  using (auth.uid() = user_id);

-- ─── Notifications ────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, is_read)
  where is_read = false;

-- ─── User Bookmarks (generic) ─────────────────────────────────────────────────

create table if not exists public.user_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, entity_type, entity_id)
);

alter table public.user_bookmarks enable row level security;

create policy "Users can manage own bookmarks"
  on public.user_bookmarks for all
  using (auth.uid() = user_id);

-- ─── Feedback ─────────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('bug', 'feature_request', 'general', 'ux')),
  text text not null,
  source text not null check (source in ('in_app', 'app_store_review', 'nps', 'micro_survey', 'shake_report')),
  device_info jsonb default '{}',
  app_version text,
  screen text,
  is_paid_user boolean default false,
  nps_score integer check (nps_score >= 0 and nps_score <= 10),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Users can create feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- ─── Performance Indexes ─────────────────────────────────────────────────────

create index if not exists idx_push_tokens_user_id
  on public.push_tokens (user_id);

create index if not exists idx_user_bookmarks_user_id
  on public.user_bookmarks (user_id);

create index if not exists idx_feedback_user_id
  on public.feedback (user_id);

-- ─── Consent Log (compliance) ─────────────────────────────────────────────────

create table if not exists public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  consented boolean not null,
  version text not null default '1.0',
  created_at timestamptz not null default now()
);

alter table public.consent_log enable row level security;

create policy "Users can manage own consent"
  on public.consent_log for all
  using (auth.uid() = user_id);

-- ─── Complete Onboarding RPC ──────────────────────────────────────────────────

create or replace function public.complete_onboarding(
  p_user_id uuid default auth.uid()
)
returns void as $$
begin
  update public.profiles
  set onboarding_completed = true,
      updated_at = now()
  where id = p_user_id;
end;
$$ language plpgsql security definer;
