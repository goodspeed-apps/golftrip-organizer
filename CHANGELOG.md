# Changelog

## [Unreleased]

### Removed
- Native visual regression (react-native-owl), retired in favor of Chromatic. A full per-app iOS/Android build for screenshot diffing does not fit a fleet-of-apps scale model (macOS runners, ~20-30 min per build, per-app baselines); Chromatic covers component visual regression on the web at a fraction of the cost. Removed `__owl__/`, `scripts/run-owl.mjs`, and `.github/workflows/visual-native.yml`. The setup never ran (the runner never passed its config to the Owl CLI, and no baselines existed).

## Cluster 7: Push Receipts, Screenshot Automation, Per-Platform SLO, Typed Widget Data, FormWizard (2026-05-13)

### Added - Push receipt polling cron
- `supabase/functions/check_push_receipts/` - Edge Function that polls the Expo getReceipts API every 5 minutes for every pending row in `push_deliveries`.
- Batches up to 1 000 pending rows per run (100 per Expo call). Rows settle to `ok`, `error`, or `expired` based on the receipt result.
- `DeviceNotRegistered` receipt errors trigger automatic deletion of the corresponding `push_tokens` row.
- `send_push` extended to write a `push_deliveries` row for each issued ticket.
- `gas.config.features.notifications.receiptPolling` block controls the cron schedule and expiry window.
- Documented in `docs/PUSH_RECEIPTS.md`.

### Added - Screenshot automation
- `.maestro/screenshots/` - five Maestro flow YAMLs covering home, signup, paywall, profile, and settings screens.
- `scripts/generate-screenshots.mjs` captures via Maestro then resizes via Sharp to all required App Store (6.7-inch, 5.5-inch) and Play Store (phone, 7-inch tablet, 10-inch tablet) sizes.
- Output under `screenshots/{platform}/{size}/{order}-{name}.png`. `store.config.json` updated with the generated paths.
- `pnpm screenshots` runs the full pipeline locally. `.github/workflows/screenshots.yml` is available via `workflow_dispatch`.
- Documented in `docs/SCREENSHOTS.md`.

### Added - Per-platform crash-free SLO thresholds
- `gasConfig.monitoring.crashFreeThresholds[env]` now accepts `number | { ios: number; android: number }`.
- Defaults: `production = { ios: 99.5, android: 99.0 }`, `staging = 95.0`, `preview = 0`.
- `scripts/crash-free-helpers.ts` exports `checkPerPlatform` which queries Sentry per platform and fails when any platform falls below its threshold.
- Documented in `docs/CRASH_FREE_SLO.md` with both scalar and object schema shapes.

### Added - Typed widget data codec
- `services/widget-data.ts` extended with a typed codec: `setWidgetData<T>(key, value)` accepts `string | number | boolean | object | array`; `getWidgetData<T>(key)` returns `T | null`.
- Codec wraps non-string values in a sentinel envelope `{ __t, v }` so the App Group container stays a string store. Legacy raw string reads continue to work.
- Size warning logged above 32 KB; writes above 64 KB are rejected.
- Documented in `docs/WIDGETS.md` with typed usage examples.

### Added - FormWizard primitive
- `components/forms/FormWizard.tsx` - reusable multi-step form component with per-step validation, progress header (Step N of M + progress bar), and controlled/uncontrolled modes.
- Accepts `schema`, `steps[{id, title, fields[], render}]`, `defaultValues`, `onComplete`, and optional `form` prop for controlled mode.
- Next button advances only when `form.trigger(fields)` passes. Back is disabled on step 0. Next becomes Finish on the last step.
- Step transitions announced via `accessibilityLiveRegion="polite"`.
- Re-exported from `services/api` as `FormWizard`, `FormWizardStep`, `FormWizardProps`.
- Documented in `docs/FORMS.md`.

## Cluster 6: Mobile Template Completeness (2026-05-13)

Ten new capabilities that close the gap between the template and a production-grade mobile reference: push notifications, OTA release channels, anonymous auth, visual regression, form library, store metadata, crash-free SLO, AppState helpers, widget scaffolding, and i18n coverage CI.

### Added - Push notifications
- `services/push.ts` - `requestPermission`, `registerForPush`, `unregister`, `updatePreferences`, `getPreferences`, `initPushHandlers`. Lazy permission prompt, token registration to `push_tokens` table, category-gated opt-in (transactional / product / marketing with marketing defaulting off).
- `supabase/functions/send_push/` - server-side fan-out via Expo Push API, batches per 100, auto-deletes `DeviceNotRegistered` tokens, writes every delivery to `audit_log`.
- `hooks/usePushPermissions` - React hook that tracks permission state and exposes a `request()` trigger.
- `gas.config.features.notifications` block for category defaults and deep-link allowlist.

### Added - OTA release channels and min-runtime gate
- `eas.json` profiles for preview, staging, and production EAS Update channels.
- `components/MinVersionGate` - wraps the app tree and renders a blocking update prompt when `Updates.runtimeVersion` is below `gasConfig.app.minRuntimeVersion`. Uses the `lib/semver.ts` comparator from cluster 3.
- `docs/RELEASE_CHANNELS.md` - rollback procedure using `eas update --branch X --republish <id>`.

### Added - Anonymous to authenticated migration
- `services/auth.ts` additions: `signInAnonymously()` wraps `supabase.auth.signInAnonymously`; `upgradeAnonymousAccount()` rejects with `{ conflictWith }` if the email already has a permanent account.
- `supabase/functions/migrate_anonymous_data/` - wraps row moves in a transaction, rolls back on any constraint violation, logs to `anonymous_migrations` table.
- `hooks/useAnonymousMigration` - tracks migration state (idle / migrating / done / error) and exposes a `migrate(email, password)` trigger.
- `docs/ANONYMOUS_AUTH.md` - opt-in instructions and table list.

### Added - Visual regression via Chromatic
- `.github/workflows/visual.yml` - runs `chromaui/action@v11` with `onlyChanged` and `exitZeroOnChanges` on PRs touching `components/_primitives/**`, `.storybook/**`, or `package.json`.
- `docs/VISUAL_REGRESSION.md` - free-tier scope (5 k snapshots/mo), baseline approval flow.

### Added - Form library (RHF + zod)
- `lib/forms.ts` - `useTypedForm<TSchema>` typed wrapper with `zodResolver` + `mode:onBlur`; `useFormServerError` reads `root.serverError`; `useAsyncFieldValidator` returns `{ isValidating, error }`.
- `components/forms/` - six primitives wired to `Controller` with full a11y props: `FormInput`, `FormSelect`, `FormTextarea`, `FormCheckbox`, `FormSwitch`, `FormButton`, `FormErrorBanner`.
- `docs/FORMS.md` - three worked examples: signup, profile edit, multi-step wizard with `useFieldArray`.

### Added - EAS store metadata
- `store.config.json` - App Store and Play Store metadata using `{{placeholder}}` tokens.
- `scripts/submit-store.mjs` - wraps `eas submit` and `eas metadata:push`; supports `--platform ios|android|all` and `--dry-run`.
- `npm run submit:store` script added to `package.json`.
- `docs/STORE_METADATA.md` - required secrets and workflow.

### Added - Crash-free SLO release gate
- `scripts/check-crash-free-slo.mjs` - queries Sentry Sessions API and exits non-zero when the 24 h crash-free rate is below `gasConfig.slo.crashFreeTarget`.
- `.github/workflows/slo-gate.yml` - blocks production EAS submit when the SLO check fails.
- `docs/CRASH_FREE_SLO.md` - operator configuration and secrets.

### Added - AppState helpers
- `hooks/useAppState` - returns current `AppStateStatus`, updates on transitions.
- `hooks/useOnForeground` - fires a stable callback each time the app moves to the foreground.
- `hooks/useOnBackground` - fires a stable callback each time the app moves to the background.

### Added - Widget scaffolding
- `modules/widget/` - Expo Module with iOS `WidgetKit` extension and Android `AppWidgetProvider` scaffold.
- `services/widget-data.ts` - `setWidgetData(key, value)` and `getWidgetData(key)` for writing to the shared App Group container.
- `docs/WIDGETS.md` - `bundleIdentifier` substitution, App Group entitlement setup.

### Added - i18n coverage CI
- `.github/workflows/i18n-coverage.yml` - runs `scripts/check-i18n-coverage.mjs` on PRs; opens an automated PR when untranslated keys are detected.
- No operator setup required; runs automatically.

### Added - services/api.ts re-exports
- Cluster 6 surface re-exported from the central `services/api.ts` barrel: push service, widget-data, anon auth additions, all five new hooks, form library helpers, seven form primitives, and `MinVersionGate`.

### Added - Documentation
- `docs/RELEASE_CHANNELS.md`, `docs/ANONYMOUS_AUTH.md`, `docs/VISUAL_REGRESSION.md`, `docs/FORMS.md`, `docs/STORE_METADATA.md`, `docs/CRASH_FREE_SLO.md`, `docs/WIDGETS.md`

### Updated - Schema
- Migration 013 - `push_tokens` table (platform check, preferences jsonb, RLS) and `anonymous_migrations` table (status check, RLS).
- Migration 014 - `migrate_anonymous_user_data` PL/pgSQL function (transaction-wrapped row moves, ROLLBACK on constraint violation).

## Cluster 5: LLM, lifecycle, multi-tenancy, growth, admin, accessibility (2026-05-12)

This is the FINAL cluster of the gas-template completeness initiative. Clusters 1–4 covered async backbone, compliance/observability, resilience/release safety, and media/search/realtime/integrations. Cluster 5 closes the remaining gaps: LLM client surface, lifecycle accessibility primitives, multi-tenancy opt-in, growth/referrals, admin console, and the i18n / a11y / RTL test scaffolding.

### Added - LLM client surface
- `services/llm.ts` - provider-agnostic `chat()`, `streamChat()`, `embed()`, `transcribe()` with `ChatMessage`, `ChatOptions`, `ChatCompletion` types
- `lib/llm-adapters/openai.ts` - OpenAI adapter (chat, streaming, embeddings, transcribe via Whisper)
- `lib/llm-adapters/anthropic.ts` - Anthropic adapter (chat, streaming; embed/transcribe gracefully throw `unsupported_capability`)
- Every call routes through `consume_cost` RPC (cluster 2 cost budgets) keyed by `gas.config.llm.costScope`. Budget exhaustion returns the cluster-2 error envelope (throttle / block / alert_only) without re-implementing the policy in the client.

### Added - Lifecycle / accessibility hooks
- `hooks/useDynamicType.ts` - returns the system font scale (iOS Dynamic Type, Android font scale) so UIs can adjust to user-set sizes
- `hooks/useReducedMotion.ts` - observes the system "reduce motion" toggle for animation gating
- `hooks/useBreakpoint.ts` - `'phone' | 'tablet' | 'desktop'` based on window width, updates on rotation/resize
- `hooks/useOrientation.ts` - `'portrait' | 'landscape'`, recomputes on dimension change
- `hooks/useBackgroundSync.ts` - periodic foreground/background data sync helper with cleanup; replaces ad-hoc `setInterval` in app state listeners

### Added - Identity primitives
- `services/apple-auth.ts` - `isAppleAuthAvailable()` + `signInWithApple()` (expo-apple-authentication wrapper)
- `services/biometric.ts` - `isBiometricAvailable()`, `authenticate()` (re-exported as `authenticateBiometric`), `requiresReauth()` (configurable max age)

### Added - Multi-tenancy (opt-in)
- `organizations` table in migration 011: `(id, name, slug, owner_user_id, metadata, created_at, updated_at)`
- `organization_members` table in migration 011: `(organization_id, user_id, role, joined_at)` with `role check in ('owner','admin','member')`
- `user_org_ids(p_user uuid)` SQL function - `SECURITY DEFINER` lookup that bypasses RLS so policies on `organization_members` can self-reference without 42P17 infinite-recursion errors. Granted to `authenticated` and `service_role`; revoked from `public`/`anon`.
- `lib/multitenancy.tsx` - `OrgProvider`, `useCurrentOrg()`, `orgFilter(query, currentOrgId)` query helper, `Organization` type
- `gas.config.multiTenancy.enabled` flag - defaults to false; feature code switches to org-scoped queries only when enabled

### Added - Growth / referrals
- `referrals` table in migration 011: `(code, referrer_user_id, referred_user_id, attribution_event, attributed_at)`
- `services/referrals.ts` - `recordAttribution(code, event)`, `listMyReferrals()`
- `services/share.ts` - `generateReferralCode()` + cross-platform `share({ code, subject, message, url? })` helper
- `lib/events.ts` - central `EVENTS` catalog + `EventName` union type; analytics calls reference event names from one place
- `hooks/useExperiment.ts` - deterministic A/B bucketing by user id; reads/writes the `experiments` table

### Added - Experiments
- `experiments` table in migration 011: `(name, user_id, variant, assigned_at)` with unique `(name, user_id)`. Backs `useExperiment(name, variants)` so the variant assignment persists across sessions.

### Added - Feedback / support
- `feedback_threads` table in migration 011: `(id, user_id, subject, status, priority, created_at, updated_at)`
- `feedback_messages` table in migration 011: `(id, thread_id, sender_id, sender_role, body, created_at)`
- RLS: users read/post own threads; admins read all + update status/priority; service role writes always

### Added - Admin console
- `profiles.role` now accepts `'admin'` (migration 011 drops + re-adds the check constraint to include the value)
- `lib/admin.ts` - `isAdmin(userId?)`, `requireAdmin()` (throws if caller isn't admin)
- `app/(admin)/` route group with `users.tsx`, `support.tsx`, `payments.tsx`, `flags.tsx` screens - gated by `requireAdmin()`
- `gas.config.admin.enabled` flag - enable the admin route group per app

### Added - UI primitives
- `components/Onboarding/` - `OnboardingProvider`, `OnboardingStep`, `OnboardingControls`, barrel export. Pluggable multi-step onboarding scaffold.
- `components/Paywall.tsx` - config-driven paywall surface
- `components/SubscriptionManager.tsx` - manage / cancel / restore screen
- `components/VirtualList.tsx` - virtualized list wrapper (FlashList-compatible API) for large data sets

### Added - Accessibility & internationalization
- `.maestro/a11y.yaml` - Maestro flow that walks the app with VoiceOver/TalkBack enabled and asserts every screen has accessible labels
- `.maestro/rtl.yaml` - Maestro flow that flips the device to an RTL locale and asserts layout doesn't regress
- `scripts/extract-i18n-keys.mjs` - scans `t('…')` call sites and writes missing keys into every `locales/<lang>.json` file
- `.github/workflows/a11y.yml` - runs `npm run lint` with `eslint-plugin-react-native-a11y`; ZERO errors required, warnings surfaced for incremental cleanup

### Added - Documentation
- `docs/CONFLICT_RESOLUTION.md` - last-write-wins vs. merge-on-conflict patterns for offline + multi-device writes

### Added - gas.config.ts blocks
- `llm` - provider (`openai` | `anthropic`), default model, cost scope
- `ui` - dynamic type clamp, reduced motion default, breakpoint thresholds, virtualization defaults
- `admin` - enable admin route group + per-screen toggles
- `multiTenancy` - enabled flag; when true, feature code uses `orgFilter()` and pages scope to current org
- `growth` - referrals enabled, share copy, experiments enabled

### Added - services/api.ts re-exports
- Cluster 5 primitives re-exported from the central `services/api.ts` barrel so app code never imports `services/llm.ts` / `hooks/useExperiment.ts` / `lib/multitenancy.tsx` directly

### Updated - Documentation
- `RUNBOOK.md` - LLM setup, multi-tenancy enable flow, admin promotion SQL, experiment authoring, i18n extract workflow, a11y CI
- `docs/SCHEMA_VERSIONING.md` - adds migration 011 to the migration ledger
- `FEATURE_CATALOG.md` - cluster 5 entries: llm_client, a11y_lint, a11y_maestro_flow, dynamic_type, reduced_motion, apple_signin, biometric_auth, breakpoint_hook, orientation_hook, onboarding_scaffold, paywall, subscription_manager, virtual_list, admin_route_group, admin_users_screen, admin_support_screen, admin_payments_screen, admin_flags_screen, multitenancy_optin, referrals, share_helper, events_catalog, experiments, background_sync, i18n_extraction, rtl_maestro_flow, conflict_resolution_doc
- `supabase/functions/README.md` - notes migration 011 tables and the `user_org_ids()` SECURITY DEFINER helper; no new edge functions

## Cluster 4: Media, search, realtime, integrations (2026-05-12)

### Added - Image pipeline
- `services/media.ts` - `pickImage` (expo-image-picker wrapper with cancellation), `uploadImage` (Supabase Storage upload with content-type detection), `signedUrlFor` (time-limited signed URL helper), `deleteImage` (storage object removal)
- `MediaError` class with `code` discriminator (`'cancelled'`, `'permission_denied'`, `'upload_failed'`, `'invalid_path'`, etc.)
- Type surface: `ImageResult`, `PickImageOptions`, `UploadImageOptions`

### Added - Postgres full-text search
- `search_with_rank` SQL helper in migration 010 - wraps `to_tsquery` + `ts_rank_cd` for any table with a `tsvector` column
- `services/search.ts` - generic `search<T>()` (table-agnostic, returns `SearchResult<T>[]` with rank), `searchSuggestions()` (prefix/typeahead helper)
- Type surface: `SearchResult<T>`, `SearchOptions`

### Added - Realtime presence + broadcast
- `services/realtime.ts` - `usePresence(channel, meta)` hook (peer list + join/leave), `useSubscription(channel, event, handler)` hook (auto-cleanup), `broadcast(channel, event, payload)` server-fanout helper
- Type surface: `PresencePeer`, `UsePresenceReturn`

### Added - Optimistic mutation hook
- `hooks/useOptimisticMutation.ts` - generic optimistic-update primitive with rollback on failure, supports any `(args) => Promise<result>` mutation paired with a local state reducer

### Added - OAuth third-party integrations
- `oauth_connections` table in migration 010: `(user_id, provider, access_token, refresh_token, expires_at, scope, metadata)`
- Encryption RPCs in migration 010: `pgsodium`-backed encrypt/decrypt for token columns; service-role-only access
- `services/oauth.ts` client helpers - `getActiveAccessToken` (auto-refresh when within 60s of expiry), `listConnections`, `disconnectProvider`. Connection persistence is server-side only: an operator-implemented OAuth callback Edge Function invokes admin-gated `oauth-save-connection` server-to-server.
- Type surface: `OAuthConnection`, `OAuthProvider`
- `oauth-save-connection` Edge Function (admin-gated) - encrypts tokens via RPC before insert
- `oauth-get-token` Edge Function (user-auth-gated) - returns decrypted access token, triggers refresh job when stale
- `oauth-refresh` Edge Function (job-dispatched, operator-implemented) - per-provider refresh handler stubs ready for app-specific wiring

### Added - Maestro E2E harness
- `.maestro/` directory with starter flows (auth, navigation smoke)
- `e2e_workflow` Github Action wired to run Maestro Cloud on PR open (opt-in via `MAESTRO_API_KEY` secret)

### Added - Storage bucket setup
- `scripts/setup-storage-buckets.sql` - idempotent bucket creation + RLS policies for the conventional `avatars/`, `user-uploads/`, `public-media/` buckets

### Added - gas.config.ts blocks
- `media` - image picker constraints, default storage bucket
- `search` - search indexing toggle, suggestion limit
- `realtime` - channel namespace prefix, presence enabled
- `integrations` - per-provider OAuth toggles (`google`, `slack`, `notion`, etc.)
- `e2e` - Maestro enabled flag

### Added - services/api.ts re-exports
- Cluster 4 primitives re-exported from the central `services/api.ts` barrel so app code never imports `services/media.ts`/`search.ts`/`realtime.ts`/`oauth.ts` directly

### Updated - Documentation
- `RUNBOOK.md` - storage bucket setup, OAuth provider onboarding, Maestro Cloud wiring
- `docs/SCHEMA_VERSIONING.md` - adds cluster 4 tables to the migration ledger

### Removed - Client surface
- `saveConnection` removed from `services/oauth.ts`. The function previously read `process.env.ADMIN_API_KEY` from a React Native context where that variable is always undefined, so the call always failed. OAuth connection persistence now happens server-side only: per-provider `oauth-callback-*` edge functions (operator-implemented) call `oauth-save-connection` directly with the admin key.

## Cluster 3: Resilience, versioning, release safety (2026-05-12)

### Added - Feature flags + kill switch + segments
- `feature_flags` table in migration 009 (`enabled`, `rollout_percentage`, `segments` jsonb, `kill` boolean)
- `lib/feature-flags.ts` with `useFlag(key)` hook: deterministic per-user rollout hash, 60s poll, kill-switch short-circuit, segment matching

### Added - Min-version gate (cold-start force-update)
- `app_versions` table in migration 009 (`platform`, `min_version`, `latest_version`, `store_url`)
- `lib/min-version.ts` semver helper + `check-min-version` Edge Function
- `context/MinVersionContext.tsx` cold-start check; mounts `components/UpdateRequired.tsx` when below `min_version`
- `gas.config.ts` gained `releaseChannels.storeUrl` (per-platform deep link target)

### Added - OTA rollout primitives
- Rollout-percentage hashing in `useFlag` (same user always lands in the same bucket)
- Public Edge Function handler scaffolding (`publicHandler`) that doesn't require auth

### Added - Schema versioning convention
- `docs/SCHEMA_VERSIONING.md` covering the `schema_version int default 1` column, two-release deprecation policy, bump workflow, audit-log warning pattern
- RUNBOOK schema-bump checklist points at the doc

### Added - Supabase codegen pipeline
- `scripts/gen-types.sh` - runs `supabase gen types typescript --linked > types/database.ts` with graceful skip when CLI / link missing
- `.husky/pre-commit` regenerates types when a `supabase/migrations/` file is staged
- `types/database.ts` placeholder so DevAgent-generated apps can `import { Database }` before first codegen
- `package.json` script `gen-types` + `prepare: husky` + husky 9 dev dep

### Added - Release notes pipeline
- `release-notes/README.md` documenting the per-version markdown convention (default H2 + per-locale H2 sections)
- `release-notes/v1.0.0.md` initial entry
- `scripts/check-release-notes.mjs` - fails CI when `release-notes/v$EXPO_PUBLIC_APP_VERSION.md` is missing
- `package.json` script `check-release-notes`
- `eas.json` production submit wired to `./release-notes/v${EXPO_PUBLIC_APP_VERSION}.md` for iOS + Android

### Added - Security scanning workflow
- `.github/workflows/security.yml` runs npm audit (high+), Semgrep, gitleaks, license-checker, bundle-size on every PR
- `scripts/security-local.mjs` (npm run security) reproduces the same suite locally

### Added - Performance budget
- `gas.config.performance.maxBundleSizeMB` + `coldStartTargetMs`
- `scripts/check-bundle-size.mjs` (npm run check-bundle) - gates PRs against the config-set bundle ceiling, with template-mode skip when no bundle exists

### Added - EAS preview per PR (opt-in)
- `.github/workflows/eas-preview.yml` publishes a `pr-{number}` EAS Update channel on PR open/update
- Workflow comments preview URL on the PR; gracefully skips when `EAS_TOKEN` secret is absent

### Added - Storybook 8 (web-only)
- `.storybook/` config (`main.ts`, `preview.ts`) wired to Vite + React Native Web
- Three component story files seeded in `stories/`
- `package.json` scripts `storybook` + `build-storybook`

### Added - Compliance, Data Rights, Observability, Cost (cluster 2 of template-completeness initiative)

- Audit log table + reusable audit trigger attached to profiles, credit_ledger, credit_balances, transactions, push_tokens, account_deletion_log
- Account deletion lifecycle: request (configurable grace, default 30 days, optional immediate), cancel within window, daily fanout job, per-user purge handler
- GDPR data export: request endpoint, background build (gzipped JSON to Storage), 7-day signed URL emailed to user
- Retention engine: generalized policy table + scheduled processor (nightly 03:19)
- Cost guardrails: 3 enforcement modes (throttle/block/alert_only), per-(scope,key,period) caps, atomic consume_cost RPC, Deno helper
- Sentry SDK on every Edge Function (replaces cluster-1 stub); admin handler auto-wraps in transaction
- iOS PrivacyInfo.xcprivacy generated from gas.config.privacy; ATT prompt helper
- Web privacy consent banner (EU-detected; localStorage + consent_log)
- Client helpers in services/api.ts: requestDataExport, requestAccountDeletion, cancelAccountDeletion
- Data rights modal screen (app/(modal)/data-rights.tsx)
- PITR setup + restore-drill runbook

### Added - Idempotency cleanup (post-cluster-1)

- `cleanup_idempotency_keys()` RPC in migration 007: deletes rows past `expires_at`
- `scripts/register-cron.sql` schedules cleanup hourly (minute 17)
- Index `idx_idempotency_keys_expires` for the cleanup query

### Added - Async Backbone Watchdog (post-cluster-1)

- `recover_stale_jobs(stale_after)` RPC in migration 006: resets jobs stuck in `running` past the threshold
- `scripts/register-cron.sql` schedules the watchdog every 5 minutes

### Added - Async Backbone (cluster 1 of template-completeness initiative)

- Job queue (`jobs` table + `claim_jobs`/`complete_job`/`fail_job` RPCs + `job-worker` function)
- Scheduled jobs pattern (pg_cron + `scripts/register-cron.sql`)
- Server-side push dispatcher (`send-push` function, Expo Push, batches by 100, cleans DeviceNotRegistered tokens)
- Transactional email via Resend (`send-email` function, 3 templates, `email_log` table)
- Server-side rate limiter (`rate_limits` table + `consume_rate_limit` RPC + `consumeRate` helper)
- Webhook receiver template (HMAC verify with prefix strip, idempotency_keys dedupe, atomic enqueue with cleanup-on-failure)
- Outbound webhook dispatch (`webhooks_out` table + `dispatch-outbound-webhook` function with timestamped HMAC signing)
- Shared Edge Function utilities: `edge-response`, `edge-client`, `edge-auth`, `edge-logger`, `escape`, `jobs`, `rate-limit`, `webhook-sig`
- Client helpers in `services/api.ts`: `enqueueJob`, `sendEmail`, `sendPush`, `registerForPush`

## [1.1.0] - 2026-03-07

### Bug Fixes
- Fix `useSubscription` querying wrong table (`users` -> `profiles`)
- Fix `ConsentBanner` schema mismatch (`granted` -> `consented` + `version`)
- Fix `ATTPrompt` schema mismatch and missing `userId` prop
- Add concurrent flush lock to `lib/offline.ts` to prevent duplicate queue processing
- Add purchase lock `finally` block in `useSubscription` to guarantee ref reset
- Fix `useOfflineSync` crashing on web (missing NetInfo guard)

### New Features
- MFA/TOTP support via `lib/mfa.ts` (Supabase Auth MFA, config-gated)
- LinkedIn and Microsoft OAuth provider stubs (config-gated)
- Consumable IAP support (`purchaseProduct`, `getCustomerInfo` in RevenueCat)
- Rich push notifications with image attachments, action buttons, and deep links
- Ads integration placeholder (`lib/ads.ts`, config-gated)
- PostHog session recording toggle
- RevenueCat customer info listener for real-time subscription updates
- `mfaRequired` state in `useAuth` hook

### Security
- Real jailbreak/root detection replacing stub (`lib/security.ts`)
- Certificate pinning documentation placeholder
- Expand Sentry `SENSITIVE_KEYS` regex with additional patterns
- PostHog property sanitization via `sanitizeData()`

### Type Safety
- Replace `as any` casts in `useSubscription`, `lib/posthog`
- Proper `ZodError` instanceof check in `useForm`
- Return type annotations on RevenueCat functions
- `ProfileRow` interface for Supabase query results

### Performance & Accessibility
- Memoize `ThemeContext` colors with `useMemo`
- Memoize `TabIcon` with `React.memo`
- Add `accessibilityLabel` to `ScoreRing`, `StepDots`
- Add `accessibilityRole="alert"` and `accessibilityLiveRegion` to `ErrorBoundary`

### Infrastructure
- Add debug symbols to EAS preview/production profiles
- Add `npm audit` and `expo config` validation to CI
- Add `dev`, `test:watch`, `test:all`, `clean` scripts
- Add `--dry-run` flag to release script
- Pin PostHog (`~3.3.0`) and Sentry (`~6.5.0`) version ranges
- Explicit `node_modules` exclude in babel config
- `exhaustive-deps` ESLint rule upgraded to error
- `__DEV__` env var validation in root layout

### Database
- Migration 003: `set_updated_at` trigger, unique email index, DELETE policy, query indexes

### Config
- Add `auth.linkedin`, `auth.microsoft`, `auth.mfa` flags to `GasAuthFeatures`
- Add `features.ads` config with `enabled` and `provider` fields

### Testing
- Additional smoke tests for config guard rails
- Configurable mock responses in test setup
- New test files: `offline.test.ts`, `mfa.test.ts`

### Polish
- Context barrel exports (`context/index.ts`)
- Wire account deletion in settings
- Filter verbose `TOKEN_REFRESHED` auth breadcrumbs
- E2E test scaffold with Maestro guide
- Cache analytics sampling (10%) to reduce PostHog noise
