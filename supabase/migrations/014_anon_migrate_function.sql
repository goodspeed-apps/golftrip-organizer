-- ─── migrate_anonymous_user_data ─────────────────
-- Migrates rows from an anonymous user to a permanent user across a list of
-- tables. Each table must have a user_id column referencing auth.users.
-- The entire loop runs inside a single PL/pgSQL call (implicitly transactional).
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