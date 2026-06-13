# Edge Functions

This directory contains Deno Edge Functions deployed to Supabase.

## Shared utilities (`_shared/`)

- `edge-response.ts` — `corsHeaders`, `json()`, `err()`, `handleOptions()`
- `edge-client.ts` — `serviceClient()`, `userClient(authHeader)` (throws if no Bearer)
- `edge-auth.ts` — `requireCronBearer(req)` (Authorization: Bearer <CRON_SECRET>, constant-time, for server-to-server callers), `requireCronSecret(req)` (x-cron-secret header variant, throws), `requireAdminJwt(req)` (JWT + profiles.role check, for human admins), `requireUserAuth(req)`
- `edge-logger.ts` — `log(level, fn, msg, extra)`, `reportException(fn, err, extra)`
- `escape.ts` — `escape(unknown)` HTML entity escape, undefined-safe
- `rate-limit.ts` — `consumeRate({ scope, key, capacity, refillPerSecond, cost? })`
- `jobs.ts` — `enqueueJob`, `claimJobs`, `completeJob`, `failJob`
- `webhook-sig.ts` — `signPayload(secret, body)`, `verifyHmacSignature({ secret, payload, signature })`
- `edge-handler.ts` — `adminHandler({ name, handler, errorCode, errorMap? })` wraps admin-gated edge functions (OPTIONS + Bearer CRON_SECRET auth + JSON parse + error envelope + Sentry hook)
- `sentry.ts` — `initSentry(fnName)`, `captureException`, `captureMessage`, `withTransaction(name, op, fn)`
- `audit-log.ts` — `writeAuditLog({ actorId, actorType, action, ... })` — failures log not throw
- `cost-tracking.ts` — `consumeCost({ scope, key, cost, period? })` — atomic check-and-record via consume_cost RPC
- `retention.ts` — `enforceRetention()` — processes retention_policies rows

## Adding a new function

1. Create `supabase/functions/<name>/index.ts` (HTTP wrapper — typically just `serve(adminHandler({...}))`.
2. If the function is callable from the job queue, also create `handler.ts` exporting a pure async function. Register it in `job-worker/index.ts` under the `handlers` map.
3. Use `_shared` utilities for cors, auth, logging, rate limit, jobs.
4. Add the function's env vars to `.env.example` and the runbook.
5. Deploy with `supabase functions deploy <name>`.

## Async backbone functions

- `job-worker` — claims and runs queued jobs. Invoked every minute by pg_cron. Gated by `requireCronBearer` (Authorization: Bearer <CRON_SECRET>).
- `send-push` — sends a push to all of a user's tokens via Expo Push (batches of 100, cleans DeviceNotRegistered tokens).
- `send-email` — sends transactional email via Resend (templates: welcome, password_reset, receipt; logs to email_log).
- `webhook-receiver` — TEMPLATE: copy, rename, configure constants per provider. Verifies HMAC, dedupes via `idempotency_keys`, enqueues a job.
- `dispatch-outbound-webhook` — delivers `webhooks_out` rows with HMAC signing (X-Signature-SHA256 + X-Timestamp), retries via job-queue.

## Compliance + observability functions (cluster 2)

- `request-data-export` (user-auth-gated) — enqueues `build_data_export` job
- `build-data-export` (job-handler) — gzips per-user JSON to Storage, signs URL, emails user
- `request-account-deletion` (user-auth-gated) — schedules deletion + audit + email
- `cancel-account-deletion` (user-auth-gated) — clears pending state within window
- `purge-pending-deletions` (job-handler, cron-triggered daily) — fans out per-user purge jobs
- `purge-account` (job-handler) — deletes user_id rows from PURGE_TABLES + auth user
- `enforce-retention` (job-handler, cron-triggered nightly) — processes retention_policies

## OAuth integration functions (cluster 4)

- `oauth-save-connection` (admin-gated) — accepts `{ user_id, provider, access_token, refresh_token?, expires_at?, scope?, metadata? }`, encrypts the token columns via `pgsodium` RPCs, upserts into `oauth_connections`. Called from server-side OAuth callback handlers — never from clients.
- `oauth-get-token` (user-auth-gated) — returns `{ access_token, expires_at }` for `(auth.uid(), provider)`. Auto-enqueues an `oauth_refresh` job when the token is within 60s of expiry so the next call gets a fresh one.
- `oauth-refresh` (job-dispatched, operator-implemented) — per-provider refresh handler stubs. DevAgent or operator fills in the provider-specific refresh URL, body, and response parsing for whichever providers the app uses (Google, Slack, Notion, etc.). Reads the encrypted refresh token via the same RPC, posts to the provider, writes the new access token + expiry back through `oauth-save-connection`.

## Cluster 5: lifecycle, multi-tenancy, growth, admin

Cluster 5 introduces no new Edge Functions — every new capability lives in client primitives (`services/llm.ts`, `hooks/useExperiment.ts`, `lib/multitenancy.tsx`, `lib/admin.ts`) and the cluster-1 cost-tracking / cluster-2 audit-log utilities already cover server-side concerns.

Migration 011 ships the supporting tables:

- `organizations` — multi-tenancy root; opt-in via `gas.config.multiTenancy.enabled`.
- `organization_members` — composite PK `(organization_id, user_id)` with `role check in ('owner','admin','member')`.
- `referrals` — growth attribution; rows inserted by `services/referrals.ts` on signup or first qualifying event.
- `feedback_threads` + `feedback_messages` — in-app support inbox surfaced by `app/(admin)/support.tsx`. RLS opens for the `admin` role on `profiles.role`.
- `experiments` — A/B bucketing storage; one row per `(experiment_name, user_id)` keeps variant assignment stable across sessions.
- `profiles.role` — check constraint extended to include `'admin'`. The role gates the admin route group in `app/(admin)/` and admin-visible RLS policies on `feedback_threads` / `feedback_messages`.

New helper function:

- `user_org_ids(p_user uuid)` — `SECURITY DEFINER` function returning the org IDs the user belongs to. Required so RLS policies on `organization_members` can self-reference without triggering 42P17 infinite-recursion errors. Granted to `authenticated` and `service_role`; revoked from `public` and `anon`. Call from RLS expressions as `auth.uid() in (select public.user_org_ids(auth.uid()))` or join against the result set.

LLM calls (`services/llm.ts`) reuse the cluster-1 `consume_cost` RPC via the shared `cost-tracking.ts` helper — no new edge function required. Cost budgets are configured in the `cost_budgets` table from cluster 2.

## Webhook receiver template

To handle a new inbound webhook provider:

1. Copy `webhook-receiver/` to `<provider>-webhook/`.
2. Edit the constants at the top of `index.ts`: `PROVIDER`, `SECRET_ENV`, `SIG_HEADER`, `SIG_PREFIX` (e.g. `'sha256='` for GitHub), `EVENT_ID_PATH`, `KIND`.
3. Implement a handler for `KIND` (see `send-email/handler.ts` for the shape) and register it in `job-worker/index.ts`.
4. Set the secret env var in your Supabase project.
5. Deploy.

## Outbound webhook signing format

Outbound webhooks sent by `dispatch-outbound-webhook` are signed as:

HMAC-SHA-256(secret, "<unix_timestamp>.<body>")

Headers sent:
- `X-Signature-SHA256: <hex>`
- `X-Timestamp: <unix_seconds>`

Receivers should reject if the timestamp is older than 5 minutes (replay window).

## Post-deploy: register cron

After deploying `job-worker`, run `scripts/register-cron.sql` (with template variables substituted) against your project DB to register the every-minute job-worker schedule, the every-5-minute stale-lock watchdog, and the hourly idempotency cleanup.

## Environment variables

- **`SUPABASE_URL`** (required) — Supabase project URL (used by `serviceClient`/`userClient`)
- **`SUPABASE_SERVICE_ROLE_KEY`** (required) — Service-role key for `serviceClient`
- **`SUPABASE_ANON_KEY`** (required) — Anon key for `userClient`
- **`CRON_SECRET`** (required) — Shared secret for server-to-server callers (pg_cron → job-worker, admin-only adminHandler endpoints). Sent as `Authorization: Bearer <CRON_SECRET>` and validated via constant-time compare.
- **`APP_URL`** (required) — App origin; used by `edge-response.ts` CORS allowlist
- **`DASHBOARD_URL`** (required) — Dashboard origin; used by `edge-response.ts` CORS allowlist
- **`RESEND_API_KEY`** (optional) — Required to actually send email via `send-email`
- **`EMAIL_FROM`** (optional) — `From:` address (defaults to `no-reply@example.com`)
- **`EXPO_ACCESS_TOKEN`** (optional) — Enhanced Expo Push rate limits
- **`SUPABASE_FUNCTIONS_URL`** (required for cron) — Used by `scripts/register-cron.sql` only
- **`<PROVIDER>_WEBHOOK_SECRET`** (per-provider) — Secret for each inbound webhook receiver

## Auth gates

Edge Functions use one of four auth gates depending on caller type:

- **`requireCronBearer`** — Server-to-server. Validates `Authorization: Bearer <CRON_SECRET>` with a constant-time compare. Used by `job-worker` and by `adminHandler()` (so all admin-gated functions: `send-email`, `dispatch-outbound-webhook`, `oauth-save-connection`, plus any other `adminHandler` consumer).
- **`requireCronSecret`** — Server-to-server cron, throws variant. Validates `x-cron-secret: <CRON_SECRET>` and throws `HttpError(401)` on mismatch. Used by `check_push_receipts` and similar handlers that propagate errors through a try/catch.
- **`requireAdminJwt`** — Human admin. Validates a Bearer JWT and checks `profiles.role === 'admin'`. Used by `grant-credits` and other human-admin endpoints.
- **`requireUserAuth`** — Authenticated end-user. Validates a Bearer JWT and returns `userId`. Used by `request-data-export`, `oauth-get-token`, etc.

The previously deprecated `requireAdminKey` (shared secret in `x-admin-key` header) was removed in P7-7 / H-7. All server-to-server callers must send `Authorization: Bearer <CRON_SECRET>` instead.
