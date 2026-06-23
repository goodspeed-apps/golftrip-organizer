-- GAS Template — Schema Improvements
-- Adds updated_at trigger, unique email constraint, DELETE policy, and query indexes.

-- ─── Updated At Trigger ──────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ─── Unique Email ────────────────────────────────────────────────────────────

create unique index if not exists idx_profiles_email_unique
  on public.profiles (email);

-- ─── DELETE Policy on Profiles (Apple/GDPR account deletion) ─────────────────

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- ─── Query Indexes ───────────────────────────────────────────────────────────

create index if not exists idx_profiles_subscription_tier
  on public.profiles (subscription_tier);

create index if not exists idx_notifications_created_at
  on public.notifications (created_at desc);

create index if not exists idx_user_bookmarks_entity_type
  on public.user_bookmarks (entity_type);

create index if not exists idx_feedback_category
  on public.feedback (category);
