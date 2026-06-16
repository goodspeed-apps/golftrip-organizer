# Crash-Free SLO Release Gate

This document explains the crash-free SLO check, how to interpret a failure,
and how to override it when needed.

## What it means

A crash-free user rate is the percentage of unique users in a given time window
who did not experience a crash. A rate of 99% means 99 out of 100 users had
zero crashes during the window.

The gate blocks production OTA releases when the rate falls below the configured
threshold. It does not block pull request merges - it only runs on release events.

## Default thresholds

- **production:** `{ ios: 99.5, android: 99.0 }` (per-platform, both enforced)
- **staging:** 95.0% (scalar, enforced)
- **preview:** 0% (disabled - check is skipped)

Thresholds are defined in `gas.config.ts` under `monitoring.crashFreeThresholds`
and the rolling window under `monitoring.crashFreeWindow` (default: `24h`).

## Per-platform thresholds

Each environment threshold accepts two shapes:

- **Scalar** (`number`): one rate applied to all platforms. Good for staging and
  preview where you do not need to distinguish between iOS and Android.
  Example: `staging: 95.0`

- **Per-platform** (`{ ios: number; android: number }`): separate rates for
  iOS and Android. The SLO gate fails if EITHER platform falls below its
  threshold. Both rates are logged regardless of pass/fail.
  Example: `production: { ios: 99.5, android: 99.0 }`

**When to use scalar vs per-platform:**

Use scalar until your app has enough traffic to produce meaningful per-platform
Sentry session data (roughly a few hundred sessions per platform per day).
Before that threshold, per-platform queries can return sparse or missing data,
making the check unreliable.

Once traffic is sufficient, split production into per-platform thresholds.
Android typically trails iOS due to device fragmentation, so a slightly lower
Android threshold (e.g. 99.0 vs 99.5) is a reasonable starting point.

**Defaults:**
- production: `{ ios: 99.5, android: 99.0 }`
- staging: `95.0`
- preview: `0` (disabled)

**Overriding per app:**

Edit `gas.config.ts` in your app:

monitoring: {
  crashFreeThresholds: {
    production: { ios: 99.8, android: 99.5 },  // stricter for your app
    staging: 95.0,
    preview: 0,
  },
  crashFreeWindow: '24h',
},

To revert to a scalar for production, replace the object with a single number:

production: 99.0,

Existing apps using a scalar value for production continue to work without
any changes.

## Required secrets

Configure these in your GitHub repository secrets (Settings > Secrets and variables > Actions):

- **SENTRY_ORG** - your Sentry organization slug (e.g. `acme-corp`)
- **SENTRY_PROJECT** - your Sentry project slug (e.g. `my-app`)
- **SENTRY_AUTH_TOKEN** - a Sentry auth token with `org:read` and `project:read` scopes

To create a token: Sentry dashboard > Settings > Auth Tokens > Create New Token.

## How to interpret a failure

A failed run means the crash-free rate for the target environment dropped below
the threshold in the configured window. Steps to investigate:

1. Open the Sentry issues dashboard:
   `https://sentry.io/organizations/{SENTRY_ORG}/issues/`
2. Filter by project, environment, and the same time window (24h or 7d).
3. Sort by "Users affected" to identify the highest-impact issues.
4. Check the release tag on the issues to confirm they are from the current release.
5. If issues are pre-existing (from a prior release), assess whether they are new
   regressions or ongoing. Pre-existing issues do not justify bypassing the gate
   unless they were already tracked and accepted.

## Manual override procedure

If a maintainer has reviewed the failures and determined the release is safe to
proceed (e.g. the crashes are in a non-critical path, already tracked, or caused
by a third-party dependency), they can override the gate:

1. Navigate to the failed workflow run on GitHub Actions.
2. Post a comment on the run (or the associated release) with the word **override**
   and a brief reason. Example:
   > override - crash is in the optional analytics plugin, non-blocking, tracked in #123
3. Re-run the failed job with the `environment` input set to the target environment.
   The script will not bypass the check automatically - the maintainer must
   explicitly re-run after documenting the reason.

There is no automated bypass flag. The override is a human gate requiring a
written reason before the release proceeds.

## Running the check locally

Use this curl command to inspect the raw Sentry response:

curl -s \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/organizations/$SENTRY_ORG/sessions/?project=$SENTRY_PROJECT&statsPeriod=24h&field=sum(session)&field=crash_free_rate(user)" \
  | jq '.groups[].totals'

Or run the script directly:

SENTRY_ORG=your-org \
SENTRY_PROJECT=your-project \
SENTRY_AUTH_TOKEN=your-token \
node scripts/check-crash-free.mjs --env production

To check staging with a 7-day window:

SENTRY_ORG=your-org \
SENTRY_PROJECT=your-project \
SENTRY_AUTH_TOKEN=your-token \
node scripts/check-crash-free.mjs --env staging --window 7d

## Adjusting thresholds

Edit `gas.config.ts`:

monitoring: {
  crashFreeThresholds: {
    production: 99.0,  // raise or lower as your app matures
    staging: 95.0,
    preview: 0,        // 0 disables the check for this environment
  },
  crashFreeWindow: '24h',  // or '7d' for a longer view
},

Lower thresholds mean more releases get through; higher thresholds catch more
regressions but may block more often during active development.