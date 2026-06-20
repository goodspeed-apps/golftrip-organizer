# GAS Template - Continuous Improvement Runbook

Operational guidelines for maintaining and improving the template over time.

---

## During Development

### Before Coding a Feature

1. **Check FEATURE_CATALOG.md** - does the template already have it?
   - If **yes** → use the template code, don't reinvent
   - If **no** → build it generically (parameterized, config-aware)

2. **Check `gas.config.ts`** - is there a feature flag for it?
   - If **yes** → use conditional rendering based on the flag
   - If **no** and it should be toggleable → add a config key first

### After Fixing a Bug

Ask: "Would this bug occur in other apps?"

- If **yes**:
  1. Fix it in `gas-template` (the source of truth)
  2. Update SYSTEM_PROMPT rules in `dev-agent.ts`
  3. Add to `TEMPLATE_README.md` under "Critical Rules"
  4. Add a smoke test in `__tests__/smoke.test.ts`

- If **no** (app-specific): fix only in that app's repo

### After Shipping a Feature

Ask: "Is this reusable across apps?"

- If **yes**:
  1. Extract to template with config flag
  2. Update `FEATURE_CATALOG.md` (change status from "Per-app" to "Static" or "Template pattern")
  3. Update `gas.config.ts` interface if new config field needed
  4. Update `TEMPLATE_README.md` with usage instructions

---

## After Each App Build

### Post-Build Retrospective

Run through these questions after every app reaches IN_DEVELOPMENT:

1. **What was generated that should have been template?**
   - Look at DevAgent output - any code that's identical to previous apps?
   - Any patterns the LLM keeps regenerating identically?

2. **What broke that the template should prevent?**
   - Build errors from boilerplate mistakes?
   - Runtime crashes from known patterns (null guards, SafeAreaView, etc.)?

3. **What config was missing?**
   - Did the DevAgent need to hardcode something that should be in `gas.config.ts`?

### Update Checklist

- [ ] Extract any patterns generated 2+ times identically → add to template
- [ ] Update DevAgent prompts → remove sections the template now handles
- [ ] Update `FEATURE_CATALOG.md` with new coverage
- [ ] Bump template version if interface changed

### Measure

Track these metrics per app build:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| LLM calls per app | 3-4 | Count in DevAgent logs |
| Tokens generated | <25K | Sum maxTokens from DevAgent sections |
| Build errors from boilerplate | 0 | Count `tsc` errors on first build |
| Time from QUALIFIED → IN_DEVELOPMENT | <15 min | Pipeline event timestamps |

---

## Template Versioning

### Scheme

- **Major** (v2.0.0): Breaking changes to `gas.config.ts` interface (fields renamed/removed)
- **Minor** (v1.1.0): New features added, new config fields (backward compatible)
- **Patch** (v1.0.1): Bug fixes, copy changes, dependency updates

### Rules

1. DevAgent references a specific template version (pinned in code)
2. Breaking changes to `GasConfig` interface = major version bump
3. Apps are generated against a template version, can be upgraded later
4. Tag releases on GitHub: `git tag v1.0.0 && git push --tags`

### Upgrade Path

When upgrading existing apps to a new template version:

1. Compare `gas.config.ts` interface changes
2. Update the app's `gas.config.ts` with new required fields
3. Copy updated template files (hooks, lib, components) to the app repo
4. Run `tsc --noEmit` to catch type errors
5. Run smoke tests
6. Publish OTA update

---

## Instrumentation Conventions

Every template file is pre-instrumented. DevAgent-generated screens MUST follow these patterns:

```typescript
// Top of every screen:
const startTime = Date.now();
useEffect(() => { track('screen_name_viewed'); }, []);

// After data loads:
useEffect(() => {
  if (data) trackScreenLoad('screen_name', startTime);
}, [data]);

// Every button/action:
onPress={() => { track('action_name', { ...context }); doAction(); }}

// Every error:
catch (error) {
  captureException(error, { screen: 'screen_name', action: 'what_failed' });
}
```

**Pre-instrumented template files:** `_layout.tsx` (auto screen tracking, cold start), `useAuth.ts`, `useSubscription.ts`, `useOfflineSync.ts`, `useSearch.ts`, `api.ts`, `notifications.ts`, `gamification.ts`, `revenuecat.ts`, `offline.ts`, `supabase.ts`, `ThemeContext.tsx`, auth screens, settings, paywall.

---

## Known Pitfalls Registry

Track recurring issues here. Each entry becomes a SYSTEM_PROMPT rule.

| Pitfall | Impact | Template Fix | SYSTEM_PROMPT Rule |
|---------|--------|-------------|-------------------|
| SafeAreaView from wrong import | Crash on modern iPhones | Template always imports from `react-native-safe-area-context` | Rule 13a, 13b, 13c |
| PostHog empty key | Crash on init | `posthog = apiKey ? new PostHog(apiKey, opts) : null` + null guards | Auth prompt CRITICAL note |
| Supabase null numerics | Crash on `.toFixed()` | `(value ?? 0).toFixed(1)` pattern | Rule 14 |
| Route to non-existent file | Crash on navigation | Route validation in smoke tests | Rule 15 |
| NativeWind arbitrary values in prod | Styles missing in release builds | Use inline styles for dynamic/dark theme values | Design system |
| Missing SafeAreaProvider | Crash on any SafeAreaView | Template `_layout.tsx` always wraps with it | Rule 13a |
| Sentry null when DSN not set | Crash if calling Sentry methods | `lib/sentry.ts` exports null-safe wrappers (no-op when disabled) | sentry.ts pattern |
| Missing screen analytics | No funnel data | Every screen must fire `track('name_viewed')` on mount | Rule 16-21 |
| Accelerometer implicit any | TS build error | Explicit type annotation on sensor callbacks | FeedbackButton pattern |

### Adding New Pitfalls

When you encounter a new crash pattern:

1. Add it to this table
2. Fix it in the template
3. Add a SYSTEM_PROMPT rule number
4. Add a smoke test that catches it
5. Update `dev-agent.ts` prompts to prevent it in generated code

---

## DevAgent Prompt Maintenance

### When to Update Prompts

- Template now handles something a prompt was instructing → remove from prompt
- New crash pattern discovered → add to SYSTEM_PROMPT rules
- New template convention → add to `TEMPLATE_README.md` (DevAgent reads this)

### Pipeline Flow

```
QUALIFIED (approved)
  → ArchitectureAgent (UX + Technical design)
  → TechnicalArchitectAgent (detailed implementation spec from PRD + UI/UX designs)
  → ProgramManagementAgent (step-by-step build plan with acceptance criteria)
  → DevAgent (executes plan, tests each step, iterates until acceptance criteria met)
  → generateAndPushIcons
  → QAAgent
  → TESTING
```

Each step enriches `researchPackage`:
- `architecture` → `technicalSpec` → `buildPlan` → generated code + `MANUAL_STEPS.md`

### Prompt Budget

With the template handling infrastructure, each LLM call has more budget:

| Section | Max Tokens | Focus |
|---------|-----------|-------|
| Technical Architect | 16,384 | Implementation spec per PRD item |
| Program Management | 16,384 | Phased build plan + acceptance criteria |
| Onboarding screens | 7,000 | App-specific onboarding steps + UI |
| Feature screens | 7,000 × 2 | App-specific tab screens + components |
| Services + types | 7,000 | App-specific API functions + data models |

### Prompt Testing

After changing prompts:
1. Run `node scripts/test-gas-config.mjs` (120 assertions)
2. Dry-run with a known architecture (e.g., ThreadLift's)
3. Verify generated code compiles: `pnpm install && pnpm exec tsc --noEmit`

---

## Feature Picker ↔ Template Sync

The admin console feature picker (Part 9) maps to `gas.config.ts` feature flags:

| Picker Category | Config Path | ArchitectureAgent Field |
|----------------|-------------|------------------------|
| Authentication → Google | `features.auth.google` | `crossCuttingFeatures.socialLogin.providers` |
| Authentication → Apple | `features.auth.apple` | `crossCuttingFeatures.socialLogin.providers` |
| Authentication → Biometric | `features.auth.biometric.enabled` | `crossCuttingFeatures.biometricAuth.enabled` |
| Engagement → Push Notifications | `features.pushNotifications.enabled` | `crossCuttingFeatures.pushNotifications.enabled` |
| Engagement → Dark Mode | `features.darkMode.enabled` | `crossCuttingFeatures.darkMode` (always on) |
| Engagement → Gamification | `features.gamification.enabled` | `crossCuttingFeatures.gamification.enabled` |
| Engagement → Help System | `features.helpSystem.enabled` | `crossCuttingFeatures.userSupport` |
| Monetization → IAP | `features.inAppPurchases.enabled` | `monetizationTiers` |
| Data → Offline Mode | `features.offlineSync.enabled` | `crossCuttingFeatures.offline.enabled` |
| Data → Search | `features.search.enabled` | `crossCuttingFeatures.search.enabled` |
| Data → i18n | `features.i18n.enabled` | `crossCuttingFeatures.i18n.enabled` |
| Data → Social Sharing | `features.socialSharing.enabled` | `crossCuttingFeatures.socialSharing.enabled` |
| Compliance → ATT Dialog | `features.compliance.attDialog` | `instrumentationPlan.attRequired` |
| Compliance → GDPR Consent | `features.compliance.gdprConsent` | - |
| Compliance → CCPA Notice | `features.compliance.ccpaNotice` | - |

When adding a new feature to the picker:
1. Add checkbox to `apps/admin-web/src/components/feature-picker.tsx`
2. Add mapping in `architectureToGasConfig()` in `dev-agent.ts`
3. Add conditional rendering in the relevant template file
4. Update this table

## Async Backbone

Generated apps inherit a complete async backbone from gas-template. See `supabase/functions/README.md` for shared utilities.

### One-time per environment

1. Set env vars in Supabase project settings: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `EXPO_ACCESS_TOKEN` (optional), `SUPABASE_FUNCTIONS_URL`.
2. Deploy functions: `supabase functions deploy job-worker send-push send-email dispatch-outbound-webhook`.
3. Register the cron: substitute variables into `scripts/register-cron.sql` and run against the project DB.

The cron registration script now schedules three jobs: `gas-job-worker` (every minute), `gas-stale-lock-recovery` (every 5 minutes), and `gas-idempotency-cleanup` (hourly). All three register together.

### Operating

- **Inspect the queue:** `select kind, status, count(*) from jobs group by kind, status;`
- **Stuck jobs:** A watchdog (`gas-stale-lock-recovery` cron, every 5 min) resets jobs in `running` for >10 min back to `pending`. Inspect: `select id, kind, locked_at, last_error from jobs where status='running' and locked_at < now() - interval '10 minutes';` (should be empty after the watchdog runs).
- **Idempotency growth:** A cleanup (`gas-idempotency-cleanup` cron, hourly) deletes rows from `idempotency_keys` past their `expires_at`. Inspect: `select count(*), min(created_at), max(created_at) from idempotency_keys where expires_at is not null and expires_at < now();` (should be 0 after the cleanup runs).
- **Replay dead jobs:** `update jobs set status='pending', attempts=0, available_at=now() where status='dead' and kind='send_email';`
- **Email failures:** `select * from email_log where status='failed' order by created_at desc limit 50;`
- **Outbound webhook failures:** `select * from webhooks_out where status='failed' order by created_at desc limit 50;`

### Adding a feature that uses async

- **Send an email:** call `sendEmail({ template, to, vars, userId? })` from `services/api.ts`.
- **Send a push:** call `sendPush({ userId, title, body, data? })` from server code, or `registerForPush(userId)` from client to enroll.
- **Run something later:** call `enqueueJob({ kind, payload, availableAt })` and register a handler in `job-worker/index.ts`.
- **Schedule something recurring:** add a row to `cron.job` via SQL (see `scripts/register-cron.sql` for the pattern).
- **Receive a webhook from a third party:** copy `supabase/functions/webhook-receiver/`, rename, configure constants.
- **Send a webhook to a third party:** insert a `webhooks_out` row, then `enqueueJob({ kind: 'dispatch_outbound_webhook', payload: { webhookId } })`.

## Compliance, Cost & Observability (cluster 2)

### One-time per environment

1. **Sentry:** create a Sentry project, copy DSN into `SENTRY_DSN` env var. Set `SENTRY_TRACES_SAMPLE_RATE` (default 0.1).
2. **Storage bucket:** create the `data-exports` bucket in Supabase Storage (one-time):
   ```sql
   insert into storage.buckets (id, name, public) values ('data-exports', 'data-exports', false)
   on conflict (id) do nothing;
   
3. **Cron registration:** the cluster-2 register-cron.sql additions schedule `gas-enforce-retention` (03:19 nightly) and `gas-purge-pending-deletions` (04:23 nightly). Both auto-register when you run the cron script.
4. **PITR setup:** upgrade the Supabase project to a tier supporting PITR (Pro or higher). Enable PITR in dashboard. Default retention 7 days.

### Operating

- **Audit log:** `select count(*), action from audit_log where created_at > now() - interval '1 day' group by action;`
- **Pending deletions:** `select id, delete_scheduled_for from profiles where pending_deletion_at is not null;`
- **Cost overruns:** `select scope, sum(cost) from cost_usage where created_at > now() - interval '1 day' group by scope order by 2 desc;`
- **Data exports queue:** `select id, status, created_at from data_export_requests where status in ('pending','processing') order by created_at;`

### Restore drill (quarterly)

1. Identify target timestamp from monitoring (e.g., 30 minutes before a corruption event).
2. From Supabase Dashboard → Database → Backups → Point-in-Time Recovery: select timestamp, click "Restore".
3. Verify: connect to the restored DB, query a known-good table, confirm row counts match expectations.
4. If restoring to a new project: update DNS/env vars in app to point at the new project.
5. Document the drill in `~/goodspeed-studio/docs/superpowers/audits/`.

### Recovery objectives

- **RPO** (Recovery Point Objective): 1 hour (PITR-bound).
- **RTO** (Recovery Time Objective): 4 hours (manual restore).

## EAS Preview Builds Per PR

The `eas-preview.yml` workflow publishes a fresh Expo Update preview every time a PR is opened or updated. It's **opt-in** because EAS updates have a per-publish cost and many template forks won't have EAS set up.

**Enable for your fork:**
1. Sign in to Expo: `eas login`
2. Generate a personal access token: `eas account:tokens:create --description "GitHub CI"`
3. In GitHub: repo settings → Secrets and variables → Actions → New repository secret
   - Name: `EAS_TOKEN`
   - Value: the token from step 2

### Visual regression (Chromatic)

The `visual.yml` workflow runs Chromatic on every PR that touches `components/_primitives/**` or `.storybook/**`. See `docs/VISUAL_REGRESSION.md` for setup, scope, and how to approve baseline changes.

**Required secret:** `CHROMATIC_PROJECT_TOKEN` (generated at chromatic.com after creating a project linked to this repo).

**What happens on PR:**
- A `pr-{number}` EAS Update channel is published with the PR title as commit message
- The workflow comments the preview URL on the PR
- Reviewers can scan the QR code from Expo Go or paste the URL into a dev-client build

**To rerun manually:**
`eas update --branch=pr-{number}` from your local machine. Use the same branch name so the in-flight PR comment stays accurate.

## Cluster 3: Resilience and Release Safety

Operating procedures for the primitives shipped in cluster 3 (feature flags, kill switch, min-version gate, OTA rollout, schema versioning, security scanning, performance budget, supabase codegen, release notes pipeline).

### OTA rollout drill (canary → 10% → 50% → 100%)

Every risky change ships behind a row in `feature_flags`. To roll out:

1. **Canary (1%):** insert `update feature_flags set rollout_percentage = 1 where key = '<flag>';` and publish the EAS Update to the `production` channel. The `useFlag` hook hashes `userId` against rollout_percentage so the same 1% sees it across reloads.
2. **10%:** after 24h with no Sentry uptick and no Pivot Score deviation, `update feature_flags set rollout_percentage = 10 where key = '<flag>';`. No new EAS publish needed - clients re-poll flags on cold start and every 60s.
3. **50% and 100%:** repeat the wait-then-bump cadence. Final bump to 100 leaves the flag in place so it can be killed quickly if needed.
4. **Cleanup:** after two full releases at 100%, remove the `useFlag` guard from code and drop the row in a follow-up migration.

### Emergency kill (under 60s)

To disable a feature in production without shipping new client code:

update feature_flags set enabled = false where key = 'kill_<feature>';

Clients poll `feature_flags` every 60s; the kill takes effect on the next poll. `useFlag('kill_<feature>')` returns true when the kill is active - guard the feature behind the inverted check. Document every kill in `~/goodspeed-studio/docs/superpowers/audits/`.

### Force-update drill

When a server change breaks clients older than a given version:

1. `update app_versions set min_version = '<semver>' where platform = '<ios|android>';`
2. On next cold start, every client below `min_version` mounts `<UpdateRequired />` and stops. The component reads `releaseChannels.storeUrl` from `gas.config.ts` and deep-links the user to the store.
3. Confirm propagation: tail `audit_log where action = 'min_version_block'` for ~10 minutes after the change. Numbers should taper as users update.
4. Set `releaseChannels.storeUrl` per platform during template setup - without it, the `<UpdateRequired />` button has nowhere to go.

### Bundle size regression triage

When the `bundle-size` job in `.github/workflows/security.yml` fails:

1. Open the failed job, scroll to the bundle report. It prints per-asset size with the largest offenders at the top.
2. **Most common cause: unintended barrel imports.** Look for `import { something } from '@<pkg>'` where the package has a barrel `index.ts` that pulls in 20 unrelated modules. Switch to subpath imports (`import { something } from '@<pkg>/something'`).
3. **Second most common: lottie animation JSON.** A 1.5MB Lottie file inflates the bundle. Move large animations to a remote URL and lazy-load.
4. Locally reproduce with `npm run check-bundle`. The script honors `performance.maxBundleSizeMB` from `gas.config.ts`.
5. If the bump is intentional (new core feature, expected size growth), raise `performance.maxBundleSizeMB` in `gas.config.ts` and call out the bump in the PR description.

### Schema bump checklist

Every breaking schema change follows the convention in [docs/SCHEMA_VERSIONING.md](docs/SCHEMA_VERSIONING.md):

1. Write the migration (`supabase/migrations/NNN_<name>.sql`).
2. `npm run gen-types` - Husky pre-commit auto-runs this if the migration is staged.
3. Add a deprecation note here (date + target removal release).
4. Verify the audit-log emits the old-version warning when an old caller hits the read path.
5. Wait two releases. Each release, scan `audit_log` for residual old-version callers.
6. Write the cleanup migration that drops the deprecated path.

### Release notes pipeline

Every release ships a `release-notes/v{semver}.md`. CI runs `npm run check-release-notes` before `eas submit` and fails when the file for the current `EXPO_PUBLIC_APP_VERSION` is missing. The first H2 in the file is the default English copy; additional H2 sections (`## de`, `## fr`) override per-locale during submission. See `release-notes/README.md` for the format.

---

## Cluster 4: Media, Search, Realtime, Integrations

### Storage bucket setup

1. Create the three recommended buckets via the Supabase dashboard:
   - `avatars` (public)
   - `attachments` (private - set "Public bucket" to off)
   - `private` (private)
2. Apply the RLS policies:
   ```bash
   psql "$DATABASE_URL" -f scripts/setup-storage-buckets.sql
   
   Or paste the file contents into the Supabase SQL editor.
3. Verify each policy via the dashboard Storage → Policies tab.

### OAuth provider wiring

Cluster 4 ships `oauth_connections` with pgcrypto-encrypted tokens. Operator workflow per provider:

1. **Generate the encryption key** (one-time per project):
   ```bash
   openssl rand -hex 32
   
   Set as Supabase Function secret:
   ```bash
   supabase secrets set OAUTH_ENCRYPTION_KEY=<the-hex-string>
   
   AND as a per-database GUC (for direct SQL access, optional):
   ```sql
   ALTER DATABASE postgres SET app.oauth_encryption_key = '<the-hex-string>';
   

2. **Register the provider in `gas.config.ts`**:
   ```ts
   integrations: {
     oauthProviders: [
       { provider: 'google', scopes: ['calendar.readonly'], refreshUrl: 'https://oauth2.googleapis.com/token' },
     ],
   }
   

3. **Implement the per-provider OAuth callback edge function**. Example (Google Calendar):
   ```ts
   // supabase/functions/oauth-callback-google/index.ts
   // Exchanges the auth code for tokens, then calls oauth-save-connection.
   

4. **Implement the per-provider refresh handler** by editing `supabase/functions/oauth-refresh/handler.ts`. The shipped template throws HttpError(501) - replace the throw with the actual refresh logic. See the file's inline comment for the contract.

5. **Use it from feature code**:
   ```ts
   import { getActiveAccessToken } from '@/services/oauth';
   const token = await getActiveAccessToken('google');
   if (token) {
     // call the third-party API
   }
   

### Postgres FTS pattern

`search_with_rank` is generic - operator adds `tsv` + `searchable_text` columns + a GIN index per table they want to search. Example for a `posts` table:

alter table public.posts
  add column searchable_text text generated always as (
    coalesce(title, '') || ' ' || coalesce(body, '')
  ) stored;

alter table public.posts
  add column tsv tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(body, '')
    )
  ) stored;

create index posts_tsv_idx on public.posts using gin (tsv);

Then from client:
const { rows } = await search<Post>({ table: 'posts', query: 'react native' });

### Realtime presence

const { peers, status } = usePresence('document:42', { user_id: user.id, name: user.name });

Each peer object includes `presence_ref` (Realtime-generated) plus whatever payload you tracked.

### Maestro E2E

See "Maestro E2E" section above (added in Task 6).

---

## Maestro E2E

Maestro is the E2E test harness for gas-template apps. YAML-driven flows run locally on simulator/device or in Maestro Cloud via CI.

### Opt-in setup

1. Sign up at https://cloud.mobile.dev
2. Create a workspace; copy the workspace ID
3. Generate an API key: `Settings → API Keys`
4. In GitHub: repo Settings → Secrets and variables → Actions → New repository secret:
   - `MAESTRO_CLOUD_API_KEY` (required)
   - `MAESTRO_WORKSPACE_ID` (required)
   - `EAS_TOKEN` (required - same as the EAS preview workflow)
5. Push a PR or merge to main; e2e.yml will build via EAS and run the smoke flow in Maestro Cloud.

### Local authoring

Install: `brew tap mobile-dev-inc/tap && brew install maestro`

Build a dev client: `eas build --profile development --platform ios --local`

Run: `maestro test .maestro/smoke.yaml`

### Adding a new flow

Copy `.maestro/smoke.yaml`, name it after the feature. Reference the Maestro command list: https://maestro.mobile.dev/api-reference/commands. Use `optional: true` for assertions that depend on conditional UI.

---

## Cluster 5: LLM, lifecycle, multi-tenancy, growth, admin

### LLM setup

1. **Pick a provider.** Set either:
   - `OPENAI_API_KEY=sk-...` (covers chat, streaming, embeddings, transcribe)
   - `ANTHROPIC_API_KEY=sk-ant-...` (covers chat, streaming; embed/transcribe throw `unsupported_capability` - pair with OpenAI if you need those)

2. **Configure `gas.config.ts`:**
   ```ts
   llm: {
     provider: 'openai',       // or 'anthropic'
     defaultModel: 'gpt-4o-mini',
     costScope: 'llm_chat',    // matches a row in cost_budgets
   }
   

3. **Set a budget.** Insert a row in `cost_budgets` (cluster 2) with `scope = 'llm_chat'`, your daily/monthly cap, and the enforcement mode (`throttle` | `block` | `alert_only`). Every `chat()` / `streamChat()` / `embed()` / `transcribe()` call routes through `consume_cost` automatically - no client-side accounting needed.

4. **Verify.** Call `chat([{ role: 'user', content: 'hello' }])` from a screen; check the `cost_events` table to confirm a row landed.

### Enable multi-tenancy

Multi-tenancy is opt-in. Default is single-tenant (every row scoped to `user_id`).

1. Flip the config:
   ```ts
   multiTenancy: { enabled: true }
   

2. Mount the provider at the root of your app (already wired when the flag is true):
   ```tsx
   <OrgProvider>
     <Stack />
   </OrgProvider>
   

3. Provision the first organization. Either:
   - Insert directly: `insert into organizations (name, slug, owner_user_id) values ('Acme', 'acme', '<uuid>')` then `insert into organization_members (organization_id, user_id, role) values ('<org-uuid>', '<uuid>', 'owner');`
   - Or call your own onboarding flow that does both inserts in a transaction.

4. Switch feature code to org-scoped queries:
   ```ts
   const { currentOrgId } = useCurrentOrg();
   const query = supabase.from('items').select();
   const { data } = await orgFilter(query, currentOrgId);
   

5. Write RLS policies against `user_org_ids()`, not against `organization_members` directly:
   ```sql
   create policy "members_read_items" on public.items for select
     to authenticated
     using (organization_id in (select public.user_org_ids(auth.uid())));
   
   Direct self-references on `organization_members` trigger 42P17 infinite-recursion errors; the SECURITY DEFINER helper bypasses RLS so the policy evaluates cleanly.

### Promote a user to admin

There's no automated promotion flow - admin access is an operator decision. Run:

UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>';

The `app/(admin)/` route group becomes accessible to that user on next app launch (or on next `useAuth` refresh). RLS policies on `feedback_threads` and `feedback_messages` open automatically because they check `profiles.role`.

To demote: `UPDATE profiles SET role = 'user' WHERE id = '<user-uuid>';`

### Author an experiment

1. Add the event name to `lib/events.ts`:
   ```ts
   export const EVENTS = {
     // ...
     ONBOARDING_VARIANT_SHOWN: 'onboarding_variant_shown',
   } as const;
   

2. Call `useExperiment` in the component:
   ```ts
   const variant = useExperiment('onboarding_copy_v2', ['control', 'treatment']);
   if (variant === 'treatment') {
     // render the new copy
   }
   

3. The hook persists the assignment to the `experiments` table on first call so the user lands in the same bucket on every subsequent session. Track exposure with the event from step 1.

### i18n extract workflow

After adding new `t('foo.bar')` calls:

node scripts/extract-i18n-keys.mjs

The script scans every `t(...)` call site and writes missing keys into every `locales/<lang>.json` file (with the English value as the placeholder for non-English files). Commit the updated locales alongside the code change. Translators fill in non-English values via your TMS or PR.

### A11y CI

`.github/workflows/a11y.yml` runs `npm run lint` with `eslint-plugin-react-native-a11y` rules enabled. Errors block merge; warnings are surfaced for incremental cleanup.

- **Zero errors** is required to merge. The ruleset is configured so structurally-broken accessibility (missing `accessibilityRole` on a `Pressable`, unlabeled image, etc.) is an error.
- **~200 existing warnings** ship with the template. These are intentionally non-blocking - clean them up incrementally as you touch each file. Run `npm run lint -- --quiet` to focus on errors only.
- Run locally with `npm run lint` before pushing.

---

## Cluster 6: Mobile Template Completeness

### Push notifications setup

Push uses the Expo Push API via the `send_push` Edge Function. The client side is handled automatically by `registerForPush()` (called after permission is granted) which writes a token row to the `push_tokens` table.

**When permission is requested:** Permission is lazy. The app calls `requestPermission()` only when you decide to surface the prompt (for example, after a user completes onboarding). Use `usePushPermissions()` to track the current status and trigger the request.

**Sending a push from the server:**

Call the `send_push` Edge Function with a service-role key:

```
POST /functions/v1/send_push
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

{ "user_ids": ["uuid1", "uuid2"], "title": "Hello", "body": "World", "data": {} }
```

The function queries `push_tokens` for all tokens belonging to those user IDs, batches them per 100 (Expo Push API limit), and calls the Expo Push API. Tokens that return `DeviceNotRegistered` are deleted automatically. Every delivery attempt is written to `audit_log`.

**Notification categories:** Three categories ship by default: `transactional`, `product`, `marketing`. Marketing defaults to off. Users can toggle per-category opt-in; preferences are stored in `push_tokens.preferences` (jsonb). Read the current preferences with `getPreferences()` and update them with `updatePreferences(prefs)`.

**Deep-link routing:** Tap handlers route incoming notifications through the deep-link allowlist defined in `gasConfig.features.notifications.deepLinkAllowlist`. Add your app's routes there to allow tap-to-navigate.

**Receipt polling:** After `send_push` dispatches notifications, Expo issues ticket IDs that must be polled asynchronously to confirm delivery. The `check_push_receipts` Edge Function handles this on a 5-minute cron. See `docs/PUSH_RECEIPTS.md` for setup, monitoring queries, and troubleshooting.

### OTA release channels operator flow

Full procedure is documented in `docs/RELEASE_CHANNELS.md`. Quick summary:

1. Set the `EAS_TOKEN` GitHub secret (Expo personal access token with project access).
2. Push a commit. The `.github/workflows/eas-preview.yml` workflow publishes to the `pr-{number}` channel and posts a preview URL as a PR comment.
3. Promote to staging: `eas update --branch staging`
4. Promote to production: `eas update --branch production`
5. Rollback: `eas update --branch production --republish <previous-update-id>`

The `MinVersionGate` component blocks the app tree when `Updates.runtimeVersion` is below `gasConfig.app.minRuntimeVersion`. Bump `minRuntimeVersion` in `gas.config.ts` whenever you ship a native breaking change that cannot be OTA-patched.

### Anonymous auth opt-in

Enable in `gas.config.ts`:

```ts
features: {
  anonymousAuth: {
    enabled: true,
    tables: ['user_preferences', 'bookmarks'],  // tables whose rows get migrated on upgrade
  }
}
```

Tables involved: `push_tokens`, `anonymous_migrations` (both from migration 013), plus any app-specific tables listed in `gasConfig.features.anonymousAuth.tables`.

Full flow documented in `docs/ANONYMOUS_AUTH.md`. The `upgradeAnonymousAccount()` call returns `{ conflictWith: email }` if the email already belongs to a permanent account so the UI can present a login prompt instead.

### Visual regression setup

1. Create a Chromatic project at chromatic.com and copy the project token.
2. Add a `CHROMATIC_PROJECT_TOKEN` GitHub secret to the repo.
3. The `.github/workflows/visual.yml` workflow runs automatically on PRs that touch `components/_primitives/**`, `.storybook/**`, or `package.json`.

The workflow uses `chromaui/action@v11` with `onlyChanged` (only snapshots affected by the diff) and `exitZeroOnChanges` (PRs do not fail; reviewers approve baselines in the Chromatic UI).

Full setup and baseline approval flow in `docs/VISUAL_REGRESSION.md`.

### Form library usage

Import from `services/api` or directly from `lib/forms` and `components/forms/`. Full API and three worked examples (signup, profile edit, multi-step wizard with `useFieldArray`) in `docs/FORMS.md`.

### Store metadata workflow

Full workflow documented in `docs/STORE_METADATA.md`.

Quick start: edit `store.config.json` (replace `{{placeholder}}` tokens), then run:

```
npm run submit:store -- --platform all --dry-run   # preview what would be submitted
npm run submit:store -- --platform all              # submit for real
```

Required GitHub secrets:
- **ASC_API_KEY_ID** - App Store Connect API key ID
- **ASC_API_ISSUER_ID** - App Store Connect issuer ID
- **ASC_API_KEY_PATH** - path to the `.p8` private key file (mounted as a secret file in CI)
- **GOOGLE_PLAY_SERVICE_ACCOUNT_PATH** - path to the Google Play service account JSON (mounted as a secret file in CI)

### Crash-free SLO operator flow

Full setup in `docs/CRASH_FREE_SLO.md`. The SLO gate queries the Sentry Sessions API for the 24 h crash-free rate and blocks the production EAS submit job when the rate is below `gasConfig.slo.crashFreeTarget` (default 99.5%).

Required GitHub secrets:
- **SENTRY_ORG** - Sentry organization slug
- **SENTRY_PROJECT** - Sentry project slug
- **SENTRY_AUTH_TOKEN** - Sentry auth token with `project:read` scope

### Widget setup

Full setup in `docs/WIDGETS.md`. The widget extension scaffold lives in `modules/widget/`. Steps:

1. Replace `{{BUNDLE_IDENTIFIER}}` in `modules/widget/ios/Info.plist` and `modules/widget/android/AndroidManifest.xml` with your app's bundle ID.
2. Add the App Group entitlement to both the main app target and the widget extension target in Xcode (use the group ID `group.{{BUNDLE_IDENTIFIER}}.widget`).
3. Write data from the main app using `setWidgetData(key, value)`. The widget reads from the shared App Group container using the same key.

### i18n coverage check

No operator setup required. The `.github/workflows/i18n-coverage.yml` workflow runs `scripts/check-i18n-coverage.mjs` automatically on every PR. When untranslated keys are detected the workflow opens an automated PR adding the missing keys (with English as the placeholder value for non-English locales).

### Cluster 6 required GitHub secrets

All new secrets introduced by cluster 6, in one place:

- **EAS_TOKEN** - Expo personal access token. Required for OTA preview builds and the store submit workflow. (Also used by the cluster 3 EAS preview workflow.)
- **CHROMATIC_PROJECT_TOKEN** - Chromatic project token. Required for the visual regression workflow.
- **ASC_API_KEY_ID** - App Store Connect API key ID. Required for iOS store submissions.
- **ASC_API_ISSUER_ID** - App Store Connect issuer ID. Required for iOS store submissions.
- **ASC_API_KEY_PATH** - Path to the App Store Connect `.p8` private key (secret file). Required for iOS store submissions.
- **GOOGLE_PLAY_SERVICE_ACCOUNT_PATH** - Path to the Google Play service account JSON (secret file). Required for Android store submissions.
- **SENTRY_ORG** - Sentry organization slug. Required for the crash-free SLO gate.
- **SENTRY_PROJECT** - Sentry project slug. Required for the crash-free SLO gate.
- **SENTRY_AUTH_TOKEN** - Sentry auth token with `project:read` scope. Required for the crash-free SLO gate.

---

## Cluster 7: Push Receipts, Screenshot Automation, Per-Platform SLO, Typed Widget Data, FormWizard

### Push receipt polling

Full setup in `docs/PUSH_RECEIPTS.md`.

The `check_push_receipts` Edge Function polls Expo on a 5-minute cron, settling every pending row in `push_deliveries`. The schedule is configurable via `gasConfig.features.notifications.receiptPolling.intervalMinutes` (default: 5).

Cron schedule is defined in `supabase/functions/check_push_receipts/cron.json`. The function authenticates via `CRON_SECRET` (same secret used by the cluster 1 job worker - no new secret needed).

To monitor delivery health, query:

select status, count(*) from push_deliveries group by status;

### Screenshot automation

Full pipeline in `docs/SCREENSHOTS.md`.

Run locally:

pnpm screenshots

This boots the simulator via Maestro, captures each flow defined in `.maestro/screenshots/`, and resizes the raw captures via Sharp to all required App Store (6.7-inch, 5.5-inch) and Play Store (phone, 7-inch tablet, 10-inch tablet) sizes. Output lands in `screenshots/{platform}/{size}/`.

Maestro must be installed (`brew install maestro`). The CI workflow (`.github/workflows/screenshots.yml`) is `workflow_dispatch` only - trigger it manually before a store submission.

### Per-platform crash-free SLO

Full configuration in `docs/CRASH_FREE_SLO.md`.

`gasConfig.monitoring.crashFreeThresholds[env]` accepts either a scalar floor (same threshold for both platforms) or an object `{ ios, android }` with separate floors. Example:

crashFreeThresholds: {
  production: { ios: 99.5, android: 99.0 },
  staging: 95.0,
  preview: 0,
}

The check script (`scripts/check-crash-free.mjs`) branches on shape and fails when any platform falls below its floor. Required secrets: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (already provisioned for the cluster 6 SLO gate).

### Typed widget data

Full API in `docs/WIDGETS.md`.

`setWidgetData<T>(key, value)` accepts any JSON-serializable value. `getWidgetData<T>(key)` returns `T | null`. The codec wraps non-string values in a sentinel envelope so the underlying App Group container stays a flat string store. Legacy raw string values are auto-detected and returned as-is.

Size guards: a warning is logged above 32 KB; writes above 64 KB are rejected. Check the device console if widget data seems stale - oversized payloads silently fail on the OS side.

### FormWizard

Full API and worked examples in `docs/FORMS.md`.

Import from `services/api`:

import { FormWizard, FormWizardStep } from 'services/api';

Pass `steps` (array of `{ id, title, fields, render }`), `schema` (zod), `defaultValues`, and `onComplete`. Each step validates only its own `fields` before allowing the user to advance.

### Cluster 7 required GitHub secrets

No new secrets are required for cluster 7.

- Push receipt polling authenticates via `CRON_SECRET` (provisioned in cluster 1).

---

## Operational secrets

This section catalogues which environment variables in the template are actually
secrets vs. which are public bundle constants that look like secrets but are not.
Treating the second group as auth credentials is a recurring source of incidents.

### `EXPO_PUBLIC_TELEMETRY_INGEST_SECRET` (NOT a secret — L-13)

Despite the name, this value is **not rotatable per-customer and not a credential**.

- It is read by `gas.config.ts` at build time and inlined into the JavaScript bundle.
- `EXPO_PUBLIC_*` env vars are shipped inside every APK / IPA. Anyone who downloads
  the binary can extract the string.
- The HMAC the client computes over telemetry payloads with this key is an
  **identity attribution tag** (which app build sent this event), not an
  authentication proof. It does not prove the caller is authorized.
- The real security boundary for the ingest endpoint lives **server-side**:
  - Rate limits per source IP / per device ID.
  - Monotonic timestamp + nonce checks to reject replays.
  - Per-app quota enforcement.
  - WAF rules on the `/api/telemetry/ingest` route.

**Do not** rotate this value hoping to revoke access. Rotation only changes the
attribution tag baked into future builds; existing builds will keep accepting and
emitting the previous value. If you suspect abuse, tighten server-side rate limits
and replay protection instead.

### Genuinely secret env vars (server-side only, never `EXPO_PUBLIC_*`)

Variables in this list must never be prefixed with `EXPO_PUBLIC_`, must live only
in server runtime config (Supabase Function secrets, Vercel env, GitHub Actions
secrets), and may be rotated to revoke access:

- `SUPABASE_SERVICE_ROLE_KEY` — full DB access; bypasses RLS.
- `CRON_SECRET` — protects scheduled-job webhooks.
- `EAS_TOKEN`, `EXPO_TOKEN` — EAS Build / Update auth.
- `SENTRY_AUTH_TOKEN` — release upload auth.
- Any per-provider OAuth refresh token endpoint credentials in `oauth-refresh/handler.ts`.

If you are about to add a new env var and you want it readable from client code,
stop and ask: would it be a problem if a competitor pulled this string out of the
APK? If yes, it belongs server-side, not in `EXPO_PUBLIC_*`.
