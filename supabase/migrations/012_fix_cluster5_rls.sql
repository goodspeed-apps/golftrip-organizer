-- Cluster 5 RLS hardening — follow-up to 011.
--
-- 1) experiments lacked an INSERT policy for authenticated users, so client
--    INSERTs silently failed. useExperiment now upserts; this policy allows it.
-- 2) feedback_messages "users_post_own_thread_messages" let any user insert
--    with author_role='admin'. Tighten so only profiles.role='admin' may post
--    as admin; regular users must post as 'user'.
-- 3) Admin policies on feedback_threads and feedback_messages re-queried
--    profiles per-row, re-triggering RLS. Replace with a SECURITY DEFINER
--    is_admin(uuid) helper, mirroring the user_org_ids pattern.

-- ─── is_admin helper ─────────────────────────────────────────────────────────

create or replace function public.is_admin(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = p_user),
    false
  );
$$;

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- ─── Harden user_org_ids search_path (defined in 011) ────────────────────────
-- Re-define with set search_path to prevent search_path-injection on the
-- SECURITY DEFINER helper. Body kept in sync with 011.

create or replace function public.user_org_ids(p_user uuid)
returns setof uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select organization_id from public.organization_members where user_id = p_user;
$$;

revoke execute on function public.user_org_ids(uuid) from public, anon;
grant execute on function public.user_org_ids(uuid) to authenticated, service_role;

-- ─── experiments INSERT policy ───────────────────────────────────────────────

drop policy if exists "users_insert_own_experiments" on public.experiments;
create policy "users_insert_own_experiments"
  on public.experiments for insert
  to authenticated
  with check (user_id = auth.uid());

-- ─── feedback_threads admin policies (use is_admin) ────────────────────────

drop policy if exists "admins_read_all_feedback_threads" on public.feedback_threads;
create policy "admins_read_all_feedback_threads"
  on public.feedback_threads for select
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "admins_update_feedback_threads" on public.feedback_threads;
create policy "admins_update_feedback_threads"
  on public.feedback_threads for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─── feedback_messages policies (use is_admin + author_role guard) ───────────

drop policy if exists "users_read_own_thread_messages" on public.feedback_messages;
create policy "users_read_own_thread_messages"
  on public.feedback_messages for select
  to authenticated
  using (
    thread_id in (
      select id from public.feedback_threads where user_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

drop policy if exists "users_post_own_thread_messages" on public.feedback_messages;
create policy "users_post_own_thread_messages"
  on public.feedback_messages for insert
  to authenticated
with check (
    author_id = auth.uid()
    and (
      (author_role = 'user'
        and thread_id in (select id from public.feedback_threads where user_id = auth.uid()))
      or (author_role = 'admin' and public.is_admin(auth.uid()))
    )
  );

-- ─── feature_flags admin write policies ─────────────────────────────────────
-- 011 left feature_flags as service_role-only writes, so admin/flags.tsx
-- mutations silently failed under RLS. Grant authenticated admins write access
-- and rely on the audit_trigger below for accountability.

drop policy if exists "admins_insert_feature_flags" on public.feature_flags;
create policy "admins_insert_feature_flags"
  on public.feature_flags for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "admins_update_feature_flags" on public.feature_flags;
create policy "admins_update_feature_flags"
  on public.feature_flags for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─── Audit triggers on cluster-5 mutable tables ───────────────────────────────
-- profiles already has trg_audit_profiles (migration 008), which covers admin
-- role changes. Add triggers on the remaining admin-mutated tables so support
-- replies, flag toggles, and feedback resolutions land in audit_log.

drop trigger if exists trg_audit_feature_flags on public.feature_flags;
create trigger trg_audit_feature_flags
  after insert or update or delete on public.feature_flags
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_feedback_threads on public.feedback_threads;
create trigger trg_audit_feedback_threads
  after insert or update or delete on public.feedback_threads
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_feedback_messages on public.feedback_messages;
create trigger trg_audit_feedback_messages
  after insert or update or delete on public.feedback_messages
  for each row execute function public.audit_trigger();

-- ─── Profiles role-escalation guard ──────────────────────────────────────────
-- Migration 001's update-own-row policy on profiles has no WITH CHECK clause,
-- so any authenticated user could `update profiles set role = 'admin' where
-- id = auth.uid()` and grant themselves the full admin surface. Silently
-- coerce role back to its prior value when the actor is not already admin —
-- no API surface change, no error for normal column updates, just a hard
-- floor on privilege escalation.

create or replace function public.profiles_protect_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not public.is_admin(auth.uid()) then
    new.role := old.role;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_protect_role() from public, anon;
grant execute on function public.profiles_protect_role() to authenticated, service_role;

drop trigger if exists trg_profiles_protect_role on public.profiles;
create trigger trg_profiles_protect_role
  before update on public.profiles
  for each row execute function public.profiles_protect_role();

-- ─── feedback_threads.user_id → profiles FK ─────────────────────────────────
-- The PostgREST embed `profiles(display_name)` from app/(admin)/support.tsx
-- only resolves if there's a foreign key from feedback_threads.user_id to
-- public.profiles. The base FK in 011 references auth.users, which PostgREST
-- can't traverse from the anon schema. Add a parallel FK to profiles.id
-- (which mirrors auth.users.id) so the embed resolves.

alter table public.feedback_threads
  drop constraint if exists feedback_threads_user_id_profiles_fk;
alter table public.feedback_threads
  add constraint feedback_threads_user_id_profiles_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;