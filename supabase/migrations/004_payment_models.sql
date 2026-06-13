-- GAS Template — Payment Model Expansion
-- Adds tables for transactions, credits, one-time products, and marketplace.
-- All tables are optional — unused tables simply have zero rows.
-- Depends on: 003_schema_improvements.sql (set_updated_at trigger function)

-- ─── Transactions (unified ledger) ───────────────────────────────────────────

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'subscription', 'one_time', 'credit_purchase', 'credit_spend',
    'credit_grant', 'marketplace_purchase', 'marketplace_payout', 'marketplace_refund'
  )),
  status text not null default 'pending' check (status in (
    'pending', 'completed', 'failed', 'refunded', 'disputed'
  )),
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  product_id text,
  credits_amount integer,
  marketplace_listing_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users can read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create index idx_transactions_user_id on public.transactions (user_id);
create index idx_transactions_type on public.transactions (type);
create index idx_transactions_created_at on public.transactions (created_at desc);

-- ─── Credit Balances ─────────────────────────────────────────────────────────

create table if not exists public.credit_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0,
  lifetime_spent integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.credit_balances enable row level security;

create policy "Users can read own credit balance"
  on public.credit_balances for select
  using (auth.uid() = user_id);

-- ─── Credit Ledger (immutable audit trail) ───────────────────────────────────

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

create policy "Users can read own credit ledger"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

create index idx_credit_ledger_user_id on public.credit_ledger (user_id);
create index idx_credit_ledger_created_at on public.credit_ledger (created_at desc);

-- ─── User Products (one-time purchase entitlements) ──────────────────────────

create table if not exists public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  transaction_id uuid references public.transactions(id),
  purchased_at timestamptz not null default now(),
  unique(user_id, product_id)
);

alter table public.user_products enable row level security;

create policy "Users can read own products"
  on public.user_products for select
  using (auth.uid() = user_id);

create index idx_user_products_user_id on public.user_products (user_id);

-- ─── Marketplace Listings ────────────────────────────────────────────────────

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null,
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'USD',
  status text not null default 'draft' check (status in (
    'draft', 'pending_approval', 'active', 'sold', 'cancelled', 'suspended'
  )),
  images text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_listings enable row level security;

create policy "Anyone can read active listings"
  on public.marketplace_listings for select
  using (status = 'active' or auth.uid() = seller_id);

create policy "Sellers can create listings"
  on public.marketplace_listings for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update own listings"
  on public.marketplace_listings for update
  using (auth.uid() = seller_id);

create index idx_marketplace_listings_seller_id on public.marketplace_listings (seller_id);
create index idx_marketplace_listings_status on public.marketplace_listings (status);
create index idx_marketplace_listings_category on public.marketplace_listings (category);

create trigger marketplace_listings_set_updated_at
  before update on public.marketplace_listings
  for each row
  execute function public.set_updated_at();

-- ─── Marketplace Orders ──────────────────────────────────────────────────────

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  seller_payout_cents integer not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in (
    'pending', 'paid', 'delivered', 'completed', 'refunded', 'disputed'
  )),
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_orders enable row level security;

create policy "Participants can read own orders"
  on public.marketplace_orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create index idx_marketplace_orders_buyer_id on public.marketplace_orders (buyer_id);
create index idx_marketplace_orders_seller_id on public.marketplace_orders (seller_id);
create index idx_marketplace_orders_listing_id on public.marketplace_orders (listing_id);

create trigger marketplace_orders_set_updated_at
  before update on public.marketplace_orders
  for each row
  execute function public.set_updated_at();

-- ─── Seller Profiles (Stripe Connect) ────────────────────────────────────────

create table if not exists public.seller_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text,
  onboarding_complete boolean not null default false,
  total_sales_cents integer not null default 0,
  total_payouts_cents integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.seller_profiles enable row level security;

create policy "Users can read own seller profile"
  on public.seller_profiles for select
  using (auth.uid() = user_id);

-- ─── Spend Credits Function (atomic, race-safe) ─────────────────────────────

create or replace function public.spend_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id uuid default null
)
returns integer as $$
declare
  v_balance integer;
  v_new_balance integer;
begin
  select balance into v_balance
  from public.credit_balances
  where user_id = p_user_id
  for update;

  if v_balance is null or v_balance < p_amount then
    raise exception 'insufficient_credits';
  end if;

  v_new_balance := v_balance - p_amount;

  update public.credit_balances
  set balance = v_new_balance,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_ledger (user_id, amount, balance_after, reason, reference_id)
  values (p_user_id, -p_amount, v_new_balance, p_reason, p_reference_id);

  insert into public.transactions (user_id, type, status, credits_amount, metadata)
  values (p_user_id, 'credit_spend', 'completed', -p_amount, jsonb_build_object('reason', p_reason));

  return v_new_balance;
end;
$$ language plpgsql security definer;

-- ─── Credit Grant Function ───────────────────────────────────────────────────

create or replace function public.grant_signup_credits(
  p_user_id uuid,
  p_amount integer
)
returns void as $$
begin
  insert into public.credit_balances (user_id, balance, lifetime_earned)
  values (p_user_id, p_amount, p_amount)
  on conflict (user_id) do update
  set balance = credit_balances.balance + p_amount,
      lifetime_earned = credit_balances.lifetime_earned + p_amount,
      updated_at = now();

  insert into public.credit_ledger (user_id, amount, balance_after, reason)
  values (p_user_id, p_amount, p_amount, 'signup_bonus');

  insert into public.transactions (user_id, type, status, credits_amount)
  values (p_user_id, 'credit_grant', 'completed', p_amount);
end;
$$ language plpgsql security definer;
