# LLM server proxy: keep provider keys off the device

**Status:** Design, ready to build. **Drafted:** 2026-06-15.

## Problem

`services/llm.ts` runs client-side (it reads the app's Supabase auth session) but calls the provider adapters in `lib/llm-adapters/` directly, and those read `process.env.ANTHROPIC_API_KEY` / `process.env.OPENAI_API_KEY`. Those are NOT `EXPO_PUBLIC_*`, so Metro does not inline them and the call fails at runtime with "key not set". That fails safe (no key ships), but it is also broken: any app that actually wants an LLM feature is one step from "fix" it by adding `EXPO_PUBLIC_ANTHROPIC_API_KEY` and reading it in the adapter, which bakes a provider key into the app bundle for anyone to extract.

A provider key in the client is a financial and security exposure: extracted from the bundle, it bills the operator's account with no per-user budget or auth.

## Principle

A provider key never touches the device. The app calls a server endpoint it is already authenticated to (its own Supabase project), and the server holds the key and forwards the request.

## Design

**Edge function `supabase/functions/llm-proxy/`** (Deno, deployed to the app's Supabase project):
- Reads `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` from `Deno.env` (Supabase function secrets, server-only).
- Requires the caller's `Authorization: Bearer <supabase-jwt>`; verifies it with the project's JWT secret and rejects anonymous calls (or allows them only if `gasConfig.llm.allowAnonymous`).
- Accepts `{ provider, kind: 'chat' | 'embed' | 'transcribe', payload }`, forwards to the provider with the server key, and streams chat back as SSE.
- Enforces the per-user budget SERVER-SIDE via the existing `consume_cost` RPC keyed on the verified `sub` (user id), so a client cannot bypass the reservation. This supersedes the client-side reservation in `services/llm.ts`.

**Client `services/llm.ts`:**
- Replace the direct `resolveAdapter().chat(...)` / `embed` / `transcribe` calls with a `callProxy(kind, payload)` that POSTs to `${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/llm-proxy` with the session token.
- Keep the adapters' rate tables (`ratesPerMillionTokens`) for client-side cost display only; their network methods are no longer invoked from the client.
- Move the cost reservation server-side (into the function); keep the client read-only budget display.

**Provisioning (studio worker):**
- During managed-app provisioning, deploy the `llm-proxy` function to the app's project and set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` as function secrets. BYO-backend apps set them in their own project.
- Gate: an app that uses LLM features but has no deployed proxy + secret must fail readiness, not ship a broken or key-leaking build.

## Guard until built

The static app-quality gate blocks any app that references an `EXPO_PUBLIC_*` provider key (`EXPO_PUBLIC_ANTHROPIC_API_KEY`, `EXPO_PUBLIC_OPENAI_API_KEY`, etc.) so the leak pattern can never reach a build, regardless of this proxy's status.

## Test plan

- Function: unit-test JWT verification (reject anon/expired), provider forward (mock fetch), SSE passthrough, and budget rejection at limit.
- Client: `services/llm.test.ts` mocks the proxy fetch instead of the adapter; assert the session token is sent and no provider key is ever read client-side.
- E2E: a managed app with the proxy deployed completes a real `chat()` round-trip; the bundle grep shows zero provider-key literals.
