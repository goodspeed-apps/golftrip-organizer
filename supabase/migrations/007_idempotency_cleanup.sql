-- GAS Template — Idempotency Keys Cleanup
-- Deletes rows from idempotency_keys past their expiry. Scheduled via pg_cron.

create or replace function public.cleanup_idempotency_keys()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  with deleted as (
    delete from public.idempotency_keys
    where expires_at is not null
      and expires_at < now()
    returning scope
  )
  select count(*) into v_count from deleted;
  return v_count;
end;
$$;

revoke execute on function public.cleanup_idempotency_keys() from public, anon, authenticated;

-- Index supporting the cleanup query.
create index if not exists idx_idempotency_keys_expires
  on public.idempotency_keys (expires_at)
  where expires_at is not null;