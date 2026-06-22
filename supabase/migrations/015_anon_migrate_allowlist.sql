-- Drop the permissive 014 version unambiguously before re-creating with the
-- allowlist.  If 015 fails mid-apply, the permissive function is gone rather
-- than left deployed.
drop function if exists public.migrate_anonymous_user_data(uuid, uuid, text[]);

create or replace function public.migrate_anonymous_user_data(
  p_anon_user_id uuid,
  p_permanent_user_id uuid,
  p_tables text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table text;
  v_count bigint;
  v_result jsonb := '{}'::jsonb;
begin
  foreach v_table in array p_tables loop
    if v_table not in (
      'feedback_threads',
      'feedback_messages',
      'experiments',
      'referrals',
      'push_tokens',
      'organization_members'
    ) then
      raise exception 'table % is not allowed for anonymous migration', v_table;
    end if;

    execute format('update public.%I set user_id = $1 where user_id = $2', v_table)
      using p_permanent_user_id, p_anon_user_id;
    get diagnostics v_count = row_count;
    v_result := v_result || jsonb_build_object(v_table, v_count);
  end loop;
  return v_result;
exception when others then
  raise;
end;
$$;

revoke execute on function public.migrate_anonymous_user_data(uuid, uuid, text[]) from public, anon;
grant execute on function public.migrate_anonymous_user_data(uuid, uuid, text[]) to service_role;