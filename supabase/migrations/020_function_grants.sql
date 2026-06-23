-- Lock down SECURITY DEFINER functions and clarify marketplace_orders policies.
-- P7-16 / M-15 (function grants + search_path)
-- P7-18 (marketplace_orders explicit service-role policy)

-- ─── P7-16: handle_new_user — search_path lockdown + revoke EXECUTE ────
-- Trigger context runs as definer; only the trigger itself (auth.users INSERT)
-- should invoke this. Revoke EXECUTE from public roles as defense-in-depth.

alter function public.handle_new_user() set search_path = public, pg_temp;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- ─── P7-16: complete_onboarding — search_path + auth.uid() guard ────────
-- Re-declare with an explicit guard so a caller cannot pass an arbitrary user
-- id to flip another user's onboarding flag. Keep callable by authenticated;
-- revoke from anon (and from public by default).

create or replace function public.complete_onboarding(
  p_user_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.profiles
  set onboarding_completed = true,
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke execute on function public.complete_onboarding(uuid) from public;
revoke execute on function public.complete_onboarding(uuid) from anon;
-- authenticated retains EXECUTE (function self-guards via auth.uid()).

-- ─── P7-18: marketplace_orders explicit service-role policy ─────────────────
-- Design intent: orders are created server-side only (Stripe webhook), never
-- by clients. The existing SELECT policy lets buyer/seller read their rows.
-- This policy makes the service-role write path explicit rather than relying
-- on the implicit RLS-bypass behavior of service_role.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'marketplace_orders'
      and policyname = 'service_role_orders'
  ) then
    create policy service_role_orders on public.marketplace_orders
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;