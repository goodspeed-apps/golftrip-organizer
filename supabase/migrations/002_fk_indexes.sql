-- GAS Template — Foreign Key Indexes
-- Adds indexes on FK columns to avoid sequential scans on cascading deletes and JOINs.
-- (PostgreSQL does NOT auto-create indexes on FK columns.)

-- push_tokens.user_id
create index if not exists idx_push_tokens_user_id
  on public.push_tokens (user_id);

-- notifications.user_id (partial index for unread already exists; this covers all queries)
create index if not exists idx_notifications_user_id
  on public.notifications (user_id);

-- user_bookmarks.user_id
create index if not exists idx_user_bookmarks_user_id
  on public.user_bookmarks (user_id);

-- feedback.user_id (nullable FK, still benefits from index)
create index if not exists idx_feedback_user_id
  on public.feedback (user_id);

-- consent_log.user_id
create index if not exists idx_consent_log_user_id
  on public.consent_log (user_id);

-- profiles.updated_at (for sorting active users)
create index if not exists idx_profiles_updated_at
  on public.profiles (updated_at);
