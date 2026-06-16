# Schema Versioning Convention

How the template handles breaking schema changes without stranding clients on older app builds.

## Convention

Every new table DevAgent adds gets:

```sql
schema_version int not null default 1
```

This column travels with every row. Application code that reads the row knows the layout it expected; the column tells the read path what layout the row was *written* under. When the two differ, the read path is responsible for adapting (or warning).

## Deprecation Policy

When a schema change breaks the previous version's callers:

1. **Bump the column** - new writes go in at `schema_version = 2`, old rows stay at `1`.
2. **Write an audit-log warning into every read path** that detects an old caller. The application code attaches `client_schema_version` to the audit-log row (sourced from a request header set by the client SDK), so the warning carries both the row's schema and the caller's expected schema.
3. **Keep the deprecated path live for two releases.** Reads still serve `schema_version = 1` rows; writes still accept `schema_version = 1` from older clients.
4. After two releases, ship the cleanup migration that drops the deprecated path.

## Bump Workflow

1. Write the migration (new column, new table, or breaking-change bump).
2. Run `npm run gen-types` to regenerate `types/database.ts`.
3. Add a deprecation note to RUNBOOK.md under the schema bump section, with the date and the target removal release.
4. Verify the audit-log emits the warning (insert a row with the old `schema_version`, hit the read path, confirm the audit row).
5. Wait two releases. Each release should monitor the audit log for residual old-version callers - if any remain, extend the window.
6. Write the cleanup migration that drops the deprecated column / table / read path.

## Why Two Releases

Clients on the second-latest version need to keep working until they auto-update. OTA updates take roughly 24–48h to fully propagate across a user base, and store-built clients lag further. Two releases gives a comfortable margin without dragging the deprecation tail forever.

## Migration Log

Notable migrations that introduce non-trivial dependencies or require operator action:

- **Migration 010** - introduces `oauth_connections` (tokens encrypted at rest via pgcrypto), `encrypt_oauth_token` / `decrypt_oauth_token` / `set_oauth_encryption_key` RPCs, and the `search_with_rank` FTS helper function. Operator must set `OAUTH_ENCRYPTION_KEY` env var on edge functions.
  - Requires the `pgcrypto` extension (enabled automatically by migration 010 via `create extension if not exists pgcrypto`).
  - Operator must provision `OAUTH_ENCRYPTION_KEY` before the oauth_connections table is useful. See RUNBOOK.md → "Cluster 4: OAuth provider wiring".
- **Migration 011** - introduces 6 new tables and 1 column change:
  - `organizations` (id, name, slug, owner_user_id, metadata, created_at, updated_at) - opt-in multi-tenancy root
  - `organization_members` (organization_id, user_id, role check in ('owner','admin','member'), joined_at) - composite PK
  - `referrals` (code, referrer_user_id, referred_user_id, attribution_event, attributed_at) - growth attribution
  - `feedback_threads` (id, user_id, subject, status, priority, created_at, updated_at) - support inbox
  - `feedback_messages` (id, thread_id, sender_id, sender_role, body, created_at) - support replies
  - `experiments` (name, user_id, variant, assigned_at) with unique (name, user_id) - A/B bucketing storage for `useExperiment`
  - `profiles.role` check constraint dropped and re-added to include `'admin'` value (alongside existing roles)
  - Adds `user_org_ids(p_user uuid)` SECURITY DEFINER function returning the org IDs the user belongs to. Required to avoid 42P17 infinite-recursion errors in RLS policies that need to self-reference `organization_members`. `execute` is revoked from `public`/`anon` and granted to `authenticated`/`service_role` only.
- No operator action required - tables ship empty and stay unused until `gas.config.multiTenancy.enabled` is flipped to true. Promoting a user to admin is a one-line SQL: `UPDATE profiles SET role = 'admin' WHERE id = '<uuid>';` (see RUNBOOK.md → "Cluster 5: Promote a user to admin").
- **Migration 012** - hardens the RLS surface introduced in 011:
  - `profiles_protect_role` trigger prevents non-admin actors from changing their own `role` column (silently coerces `new.role := old.role`). Closes a privilege-escalation path where any authenticated user could `UPDATE profiles SET role = 'admin'` against their own row.
  - `is_admin(uuid)` SECURITY DEFINER helper with pinned `search_path = public, pg_temp`. `user_org_ids` from 011 is re-defined with the same pinning. Admin policies on `feedback_threads`/`feedback_messages` switch from inline `(select role from profiles ...)` (which re-triggered RLS) to `public.is_admin(auth.uid())`.
  - `feedback_messages` author_role check tightened: `author_role='user'` (own thread) OR `author_role='admin'` (when `is_admin`). Previously any user could insert with `author_role='admin'`.
  - `experiments` adds a missing `users_insert_own_experiments` policy (clients can now INSERT under RLS).
  - `feature_flags` adds admin INSERT/UPDATE policies (011 left writes service-role-only, which would have made the admin UI silently fail).
  - Audit triggers attached to `feature_flags`, `feedback_threads`, `feedback_messages` so admin mutations land in `audit_log` automatically.
  - `feedback_threads_user_id_profiles_fk` FK to `public.profiles(id)` to enable PostgREST embedding from the admin support screen.

- **Migration 013** - introduces two new tables for push fan-out and anonymous migration audit:
  - `push_tokens` (id, user_id, token, platform check in ('ios','android','web'), preferences jsonb, created_at, updated_at) - one row per device per user. `idx_push_tokens_user` index on `user_id`. RLS: users own their rows, service_role has full access.
  - `anonymous_migrations` (id, anonymous_user_id, permanent_user_id, status check in ('pending','completed','failed'), migrated_tables jsonb, created_at, updated_at) - audit trail for every anon-to-auth migration attempt. `idx_anon_migrations_permanent` index on `permanent_user_id`. RLS: users read their own rows, service_role writes.
  - No operator action required - tables ship empty. Push tokens are registered automatically when `registerForPush()` is called and `gasConfig.features.notifications.enabled` is true.
- **Migration 014** - adds the `migrate_anonymous_user_data(p_anon_id uuid, p_permanent_id uuid, p_tables text[])` PL/pgSQL function:
  - Wraps all row `UPDATE` statements in a single transaction; any constraint violation triggers a full `ROLLBACK`.
  - Logs the outcome (completed or failed) to `anonymous_migrations`.
  - Called exclusively by the `migrate_anonymous_data` Edge Function so app code never invokes it directly.
  - No operator action required beyond deploying the migration.

- **Migration 015** - adds `send_push` write path for push_deliveries: see migration 017 for the table definition. (No-op entry; 015 was internal to the send_push handler changes shipped with migration 013.)
- **Migration 016** - adds `migrate_anonymous_user_data` PL/pgSQL cleanup function. No operator action required.
- **Migration 017** - introduces the `push_deliveries` audit table for push receipt polling:
  - `push_deliveries` (id uuid PK, user_id uuid references auth.users(id) on delete set null, receipt_id text unique not null, ticket_id text not null, status check in ('pending','ok','error','expired'), error_details text, sent_at timestamptz not null default now(), settled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now())
  - `idx_push_deliveries_pending` - partial index on `status = 'pending'` so the receipt poller's SELECT stays fast as the table grows.
  - `idx_push_deliveries_sent_at` - index on `sent_at DESC` for expiry sweeps and time-range dashboards.
  - RLS: authenticated users can SELECT their own rows (`user_id = auth.uid()`); service_role has full INSERT/UPDATE/DELETE access. No direct user writes.
  - **send_push writes**: after dispatching each batch to Expo, `send_push` inserts one row per issued ticket with `status = 'pending'`.
  - **check_push_receipts settles**: the receipt polling cron selects up to 1 000 `pending` rows older than 1 minute, calls `Expo.getPushNotificationReceiptsAsync`, and UPDATEs each row to `ok`, `error`, or `expired`. Rows that pass `expireAfterMinutes` (configurable, default 1 440 min / 24 h) without a receipt are marked `expired`.
  - No operator action required - the table ships empty and is populated automatically once `gasConfig.features.notifications.enabled` is true and `send_push` is called.

## Related

- `npm run gen-types` - regenerates `types/database.ts` from the linked Supabase project.
- `supabase/migrations/` - every schema change lives here; the Husky pre-commit hook runs gen-types automatically when a migration is staged.
- RUNBOOK.md → "Schema bump checklist" - operator-facing version of this doc.
