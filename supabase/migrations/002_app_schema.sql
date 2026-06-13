-- 002_app_schema.sql — app-specific domain tables.
-- Generated deterministically by DevAgent from architecture.dataModels.
-- Do NOT recreate tables from 001_base_schema.sql.

-- Users (users)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  display_name text not null,
  avatar_url text,
  handicap numeric(4,1),
  subscription_tier text not null,
  revenuecat_user_id text,
  push_token text,
  theme_preference text not null,
  trip_streak integer not null,
  total_rounds_played integer not null,
  avg_score numeric(5,2),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.users enable row level security;
drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users for select using (auth.uid() = id);
drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users for update using (auth.uid() = id);

-- Trips (trips)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  invite_code text not null,
  invite_email_address text,
  status text not null,
  member_limit integer not null,
  recap_unlocked boolean not null,
  recap_product_id text,
  cover_image_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.trips enable row level security;
drop policy if exists "trips_read_public" on public.trips;
create policy "trips_read_public" on public.trips for select to anon, authenticated using (true);

-- TripMembers (trip_members)
create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid,
  guest_name text,
  guest_email text,
  role text not null,
  rsvp_status text not null,
  days_playing date[],
  notifications_muted boolean not null,
  joined_at timestamptz not null,
  updated_at timestamptz default now() not null
);
create index if not exists trip_members_user_id_idx on public.trip_members(user_id);
alter table public.trip_members enable row level security;
drop policy if exists "trip_members_select_own" on public.trip_members;
create policy "trip_members_select_own" on public.trip_members for select using (auth.uid() = user_id);
drop policy if exists "trip_members_insert_own" on public.trip_members;
create policy "trip_members_insert_own" on public.trip_members for insert with check (auth.uid() = user_id);
drop policy if exists "trip_members_update_own" on public.trip_members;
create policy "trip_members_update_own" on public.trip_members for update using (auth.uid() = user_id);
drop policy if exists "trip_members_delete_own" on public.trip_members;
create policy "trip_members_delete_own" on public.trip_members for delete using (auth.uid() = user_id);

-- TeeTimes (tee_times)
create table if not exists public.tee_times (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  course_name text not null,
  course_city text,
  tee_date date not null,
  tee_time time not null,
  player_count integer not null,
  confirmation_number text,
  source text not null,
  import_raw jsonb,
  player_ids uuid[],
  notes text,
  created_by uuid not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.tee_times enable row level security;
drop policy if exists "tee_times_read_public" on public.tee_times;
create policy "tee_times_read_public" on public.tee_times for select to anon, authenticated using (true);

-- Expenses (expenses)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  category text not null,
  description text not null,
  amount_cents integer not null,
  currency text not null,
  paid_by_member_id uuid not null,
  split_type text not null,
  split_member_ids uuid[],
  split_date date,
  expense_date date not null,
  is_settled boolean not null,
  created_by uuid not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.expenses enable row level security;
drop policy if exists "expenses_read_public" on public.expenses;
create policy "expenses_read_public" on public.expenses for select to anon, authenticated using (true);

-- ExpenseSettlements (expense_settlements)
create table if not exists public.expense_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  from_member_id uuid not null,
  to_member_id uuid not null,
  amount_cents integer not null,
  currency text not null,
  is_paid boolean not null,
  venmo_deeplink text,
  paypal_deeplink text,
  paid_at timestamptz,
  created_at timestamptz default now() not null
);
alter table public.expense_settlements enable row level security;
drop policy if exists "expense_settlements_read_public" on public.expense_settlements;
create policy "expense_settlements_read_public" on public.expense_settlements for select to anon, authenticated using (true);

-- Rounds (rounds)
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  tee_time_id uuid,
  course_name text not null,
  round_date date not null,
  is_complete boolean not null,
  created_by uuid not null,
  created_at timestamptz default now() not null
);
alter table public.rounds enable row level security;
drop policy if exists "rounds_read_public" on public.rounds;
create policy "rounds_read_public" on public.rounds for select to anon, authenticated using (true);

-- Scores (scores)
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null,
  trip_id uuid not null,
  member_id uuid not null,
  total_score integer,
  score_relative_to_par integer,
  hole_scores jsonb,
  is_verified boolean not null,
  created_by uuid not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.scores enable row level security;
drop policy if exists "scores_read_public" on public.scores;
create policy "scores_read_public" on public.scores for select to anon, authenticated using (true);

-- Messages (messages)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  sender_member_id uuid,
  guest_name text,
  body text not null,
  thread_date date,
  is_announcement boolean not null,
  is_deleted boolean not null,
  created_at timestamptz default now() not null
);
alter table public.messages enable row level security;
drop policy if exists "messages_read_public" on public.messages;
create policy "messages_read_public" on public.messages for select to anon, authenticated using (true);

-- Announcements (announcements)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  message_id uuid,
  body text not null,
  created_by uuid not null,
  is_active boolean not null,
  created_at timestamptz default now() not null
);
alter table public.announcements enable row level security;
drop policy if exists "announcements_read_public" on public.announcements;
create policy "announcements_read_public" on public.announcements for select to anon, authenticated using (true);

-- EmailImports (email_imports)
create table if not exists public.email_imports (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  raw_email_body text not null,
  sender_email text,
  parsed_course_name text,
  parsed_tee_date date,
  parsed_tee_time time,
  parsed_player_count integer,
  parsed_confirmation_number text,
  parse_status text not null,
  tee_time_id uuid,
  received_at timestamptz not null
);
alter table public.email_imports enable row level security;
drop policy if exists "email_imports_read_public" on public.email_imports;
create policy "email_imports_read_public" on public.email_imports for select to anon, authenticated using (true);

-- TripRecaps (trip_recaps)
create table if not exists public.trip_recaps (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  winner_member_id uuid,
  best_round_score integer,
  group_avg_score numeric(5,2),
  total_cost_per_person_cents integer,
  recap_image_url text,
  generated_at timestamptz,
  purchase_transaction_id text,
  created_at timestamptz default now() not null
);
alter table public.trip_recaps enable row level security;
drop policy if exists "trip_recaps_read_public" on public.trip_recaps;
create policy "trip_recaps_read_public" on public.trip_recaps for select to anon, authenticated using (true);

-- OfflineMutationQueue (offline_mutation_queue)
create table if not exists public.offline_mutation_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  trip_id uuid not null,
  operation text not null,
  table_name text not null,
  payload jsonb not null,
  created_at timestamptz default now() not null,
  replayed_at timestamptz,
  status text not null
);
create index if not exists offline_mutation_queue_user_id_idx on public.offline_mutation_queue(user_id);
alter table public.offline_mutation_queue enable row level security;
drop policy if exists "offline_mutation_queue_select_own" on public.offline_mutation_queue;
create policy "offline_mutation_queue_select_own" on public.offline_mutation_queue for select using (auth.uid() = user_id);
drop policy if exists "offline_mutation_queue_insert_own" on public.offline_mutation_queue;
create policy "offline_mutation_queue_insert_own" on public.offline_mutation_queue for insert with check (auth.uid() = user_id);
drop policy if exists "offline_mutation_queue_update_own" on public.offline_mutation_queue;
create policy "offline_mutation_queue_update_own" on public.offline_mutation_queue for update using (auth.uid() = user_id);
drop policy if exists "offline_mutation_queue_delete_own" on public.offline_mutation_queue;
create policy "offline_mutation_queue_delete_own" on public.offline_mutation_queue for delete using (auth.uid() = user_id);

-- Foreign keys (PostgREST embedded joins depend on these).
do $$ begin
  alter table public.trip_members add constraint trip_members_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tee_times add constraint tee_times_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.expenses add constraint expenses_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.expense_settlements add constraint expense_settlements_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rounds add constraint rounds_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rounds add constraint rounds_tee_time_id_fkey foreign key (tee_time_id) references public.tee_times(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.scores add constraint scores_round_id_fkey foreign key (round_id) references public.rounds(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.scores add constraint scores_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.messages add constraint messages_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.announcements add constraint announcements_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.announcements add constraint announcements_message_id_fkey foreign key (message_id) references public.messages(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.email_imports add constraint email_imports_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.email_imports add constraint email_imports_tee_time_id_fkey foreign key (tee_time_id) references public.tee_times(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trip_recaps add constraint trip_recaps_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.offline_mutation_queue add constraint offline_mutation_queue_trip_id_fkey foreign key (trip_id) references public.trips(id) on delete cascade;
exception when duplicate_object then null; end $$;
