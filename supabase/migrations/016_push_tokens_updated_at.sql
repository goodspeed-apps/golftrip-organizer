-- ─── push_tokens: add updated_at column ─────────────────────────────────────
-- services/push.ts writes updated_at in upsert and update calls; the column
-- was absent from migration 013.  Add as a NOT NULL column with default now().

alter table public.push_tokens
  add column if not exists updated_at timestamptz not null default now();

-- Keep updated_at current automatically on every update
create or replace function public._set_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_push_tokens_updated_at on public.push_tokens;
create trigger trg_push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public._set_push_tokens_updated_at();