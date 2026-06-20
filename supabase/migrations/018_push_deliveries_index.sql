-- Migration 018: improve push_deliveries index and add created_at
--
-- I7: The cron query filters status='pending' AND sent_at < threshold.
--     The existing bare (status) WHERE status='pending' index is not selective
--     enough for that query. Drop it and add a composite index on (sent_at ASC)
--     with the same partial WHERE clause so the poller scan is index-only.
--
-- M6: Add created_at as the operator-managed record timestamp.
--     sent_at remains the notification dispatch timestamp (operator-provided).

-- Drop the bare status partial index from migration 017.
drop index if exists public.idx_push_deliveries_status;

-- Add composite partial index suited for the receipt-poller query:
--   SELECT ... FROM push_deliveries WHERE status = 'pending' AND sent_at < $threshold
--   ORDER BY sent_at ASC LIMIT $max_rows
create index if not exists idx_push_deliveries_pending_sent_at
  on public.push_deliveries (sent_at asc)
  where status = 'pending';

-- Add created_at column (separate from sent_at which is the notification timestamp).
alter table public.push_deliveries
  add column if not exists created_at timestamptz not null default now();