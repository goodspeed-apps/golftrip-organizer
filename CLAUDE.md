# GAS Template — Claude Instructions

This is the **gas-template** repo. Goodspeed Studio's DevAgent clones it for every new app, so every change here propagates to every generated app. Keep the template generic, feature-flag-driven, and secure.

## What this repo is

Static React Native + Expo template. ~70 files, 246-feature catalog (`FEATURE_CATALOG.md`). DevAgent layers app-specific code on top — the template itself never names a product or hardcodes business logic.

**Stack:** Expo + expo-router, Supabase (Auth/DB/Storage/Realtime/Edge Functions), NativeWind, PostHog + Sentry, multi-provider LLM, Jest.

**Docs that matter:**
- `FEATURE_CATALOG.md` — what's in the template, organized by feature
- `RUNBOOK.md` — operator-facing setup, env vars, deploy procedures
- `CHANGELOG.md` — release notes
- `docs/SCHEMA_VERSIONING.md` — migration log + schema-bump workflow
- `docs/CONFLICT_RESOLUTION.md` — write-conflict policy for sync code

## Security Checklist (MANDATORY before merge)

Changes here ship to every app built on the template. Each rule has bitten someone.

1. **ConsentBanner gates analytics.** PostHog and RevenueCat MUST NOT initialize until the user grants consent. Use the `getPostHog()` lazy pattern.
2. **Auth tokens in SecureStore only.** Use `expo-secure-store` via `ExpoSecureStoreAdapter`. Never AsyncStorage for credentials.
3. **PKCE flow enforced.** All OAuth providers use `flowType: 'pkce'`. Never implicit.
4. **Deep-link validation.** Auth callback handlers MUST validate the URL scheme matches `gasConfig.app.scheme`.
5. **No `dangerouslySetInnerHTML`.** Use `sanitizeUserInput()` from `lib/sanitize.ts` for user-generated text.
6. **RLS on every table.** Every Supabase migration enables RLS and adds policies. No exceptions.
7. **Edge-function auth.** User-facing functions validate JWT via `supabase.auth.getUser()`. Server-to-server functions validate `CRON_SECRET`.
8. **No mass assignment.** DB inserts use explicit field destructuring. Never `...body` spread.
9. **CSV exports sanitized.** Use `sanitizeCsvCell()` from `lib/sanitize.ts` on all user-controlled fields.
10. **Jailbreak detection active.** `isDeviceRooted()` from `lib/security.ts` runs on app start.
11. **Sign-in-with-Apple uses a nonce.** Use `signInWithApple()` from `services/apple-auth.ts` — never call `supabase.auth.signInWithIdToken({provider: 'apple'})` directly.
12. **No `Math.random()` for security material.** Use `lib/crypto.randomBase32` or `expo-crypto` directly.
13. **`profiles.role` is privilege-gated.** Migration 012 installs a trigger that blocks non-admin role escalation. Don't disable it.
14. **SECURITY DEFINER functions pin `search_path`.** New definer functions must `set search_path = public, pg_temp`.

## Conventions

- **Config:** `gas.config.ts` is the single source of truth for feature flags (`gasConfig.features.*`, `gasConfig.growth.*`, etc.). Never inline a flag in code.
- **Errors:** `services/*` throws `ServiceError(code, status, message)`. UI catches and renders.
- **Caching:** `lib/offline.cacheQuery` + `getCached` for persistent SWR. `withCache(key, loader, ttl)` for memoized read-through.
- **Hashing / bucketing:** `lib/hash.assignBucket(userId, key, modulus)` for flag rollouts and experiment variants. Don't reimplement FNV-1a.
- **Auth helper:** `lib/supabase.getCurrentUserId()`. Don't roll your own `getSession()` unwrap.
- **Retry:** `lib/retry.retryWithBackoff` + `isTransientNon4xxError` for any network call that can fail transiently.
- **Crypto:** `lib/crypto.randomBase32` for codes, `expo-crypto` for hashes/random bytes elsewhere.
- **Sharing:** `lib/sharing.shareContent` (handles web fallback + Sentry). `services/share.ts` wraps it with referral attribution.
- **LLM streaming:** new providers extend `lib/llm-adapters/types.ts` and use `lib/llm-adapters/sse.parseSSE` for SSE.
- **Events:** typed catalog at `lib/events.ts`. Use `EVENTS.foo` constants, never bare strings.

## Migrations

`supabase/migrations/` is the source of truth and is **not** auto-applied to prod. Before shipping code that depends on a new schema, verify the column / table exists in prod (`gen-types` or a direct query). Document each migration in `docs/SCHEMA_VERSIONING.md`.

## Build / test commands

- `npm run typecheck` — `tsc --noEmit`. 9 TS1323 errors are the pre-existing baseline (dynamic-import patterns in test files). Don't add new errors.
- `npm test` — `jest --selectProjects smoke` (fast, ~1s).
- `pnpm exec jest` — full sweep, 6 projects, 95 suites, 627+ tests.
- `npm run lint` — ESLint, 0 errors required.
- `npm run security` — local security sweep (audit + license-check). Run before tagging.
- `npm run check-bundle` — bundle-size budget (skips automatically when run inside the unprovisioned template).

## Standing rules from the user

- **No em dashes** in generated docs or copy. **Never use the word "AI"** in user-facing copy.
- **No markdown tables** in generated docs — use bold-label bullet lists.
- **All icons are FontAwesome Pro** (`pro-light` / `pro-regular` / `pro-solid` v7). No inline SVGs.
- **No time estimates** in any plan or status update.
- **No "v2" or "later" deferrals.** Every reported issue is fixed in the same pass.
- **Commit + push to `main` is atomic.** When work is done, both happen — never finish a response after a commit without the push.
- **Run `/simplify` after every code change.** Run `/plan-verify` after `/simplify`. Re-run both after any followup cleanup before pushing.

## End-of-task summary

When you finish a non-trivial task: 2–3 sentences. What changed, what's next. Nothing else. Don't recap the diff — the user can read it.
