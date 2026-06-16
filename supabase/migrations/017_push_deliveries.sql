create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  receipt_id text not null unique,
  push_token text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('pending', 'ok', 'error', 'expired')) default 'pending',
  error_message text,
  error_code text,
  sent_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists idx_push_deliveries_status on public.push_deliveries (status) where status = 'pending';
create index if not exists idx_push_deliveries_sent_at on public.push_deliveries (sent_at desc);

alter table public.push_deliveries enable row level security;

drop policy if exists "users_read_own_push_deliveries" on public.push_deliveries;
create policy "users_read_own_push_deliveries" on public.push_deliveries for select to authenticated using (user_id = auth.uid());

drop policy if exists "service_role_write_push_deliveries" on public.push_deliveries;
create policy "service_role_write_push_deliveries" on public.push_deliveries for all to service_role using (true) with check (true);