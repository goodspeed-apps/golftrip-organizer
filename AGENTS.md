# GAS Template — Agent Quick Reference

See `CLAUDE.md` for the full rules. This is the condensed reference for non-Claude agents (Cursor, Codex, etc.) and for quick lookups.

## Purpose

Static template cloned by Goodspeed Studio's DevAgent. Ships ~70 files and a 246-feature catalog (`FEATURE_CATALOG.md`). DevAgent generates app-specific code on top — keep the template generic and feature-flag-driven.

## Stack

- **App framework:** Expo (React Native) + expo-router
- **Auth / DB:** Supabase (`lib/supabase.ts`, PKCE + SecureStore)
- **State:** React context (`context/`) + hooks (`hooks/`)
- **Styling:** NativeWind + theme tokens (`context/ThemeContext`)
- **Telemetry:** PostHog (`lib/posthog`), Sentry (`lib/sentry`)
- **LLM:** multi-provider adapter (`services/llm.ts` + `lib/llm-adapters/`)
- **Tests:** Jest, 6 projects (smoke / lib / hooks / services / components / edge-functions)

## Key conventions

- **Config:** `gas.config.ts` is the single source of truth — never inline a feature flag.
- **Errors:** `services/*` throws `ServiceError(code, status, message)`; UI catches and renders.
- **Cache:** `lib/offline.cacheQuery` + `getCached` for persistent SWR. `withCache(key, loader, ttl)` for memoized read-through.
- **Crypto:** `lib/crypto.randomBase32` for codes; `expo-crypto` for hashes/random bytes. Never `Math.random()` for security material.
- **Hashing / bucketing:** `lib/hash.assignBucket(userId, key, modulus)` for flag rollouts and experiment variants.
- **Auth helper:** `lib/supabase.getCurrentUserId()` — don't unwrap `getSession()` by hand.
- **Retry:** `lib/retry.retryWithBackoff` + `isTransientNon4xxError` for any transient-failing network call.
- **Sharing:** `lib/sharing.shareContent` (web fallback + Sentry). `services/share.ts` adds referral attribution.
- **LLM streaming:** `lib/llm-adapters/sse.parseSSE` — new adapters reuse it.
- **Events:** `lib/events.EVENTS` typed catalog — no bare event-name strings.

## Migrations

`supabase/migrations/` is the source of truth and is **not** auto-applied to prod. Verify column / table existence in prod before shipping code that depends on a new schema. Log each migration in `docs/SCHEMA_VERSIONING.md`.

## Package manager

This repo uses **pnpm v10+** exclusively. Do not run `npm install` — it would regenerate `package-lock.json` and cause lockfile divergence. Always use `pnpm install`.

## Build / test

pnpm run typecheck      # tsc --noEmit (9 TS1323 errors are pre-existing baseline)
pnpm test               # jest --selectProjects smoke (fast)
pnpm exec jest          # full sweep, 95 suites / 627+ tests
pnpm run lint           # eslint, 0 errors required
pnpm run security       # audit + license-check before tagging

## Security must-haves

- RLS on every table.
- Auth tokens in SecureStore only.
- PKCE for every OAuth provider.
- Sign-in-with-Apple via `services/apple-auth.ts` (nonce-protected).
- SECURITY DEFINER functions pin `search_path = public, pg_temp`.
- `profiles.role` is protected by trigger in migration 012; do not bypass.
- Edge functions validate JWT (user-facing) or `CRON_SECRET` (server-to-server).

## House rules

- No em dashes, no "AI" word, no markdown tables in generated docs.
- All icons FontAwesome Pro (v7).
- Never `Math.random()` for codes, tokens, or nonces.
- No `dangerouslySetInnerHTML` — use `lib/sanitize.sanitizeUserInput`.
- DB inserts use explicit field destructuring, never `...body` spread.
