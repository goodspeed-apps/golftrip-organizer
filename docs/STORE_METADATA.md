# Store Metadata as Code

The template ships `store.config.json` — a version-controlled description of App Store and Play Store metadata — and a wrapper script (`npm run submit:store`) that drives `eas submit` and `eas metadata:push` from CI or your local machine.

## Why this exists

Manually clicking through App Store Connect and Play Console to update titles, descriptions, screenshots, and keywords is error-prone and leaves no audit trail. Treating store metadata as code means:

- Every change goes through PR review
- Localization stays consistent across stores
- Rollback is `git revert`
- DevAgent can fill in `{{placeholder}}` tokens at generation time

## File layout

- `store.config.json` — the metadata source of truth at the repo root
- `scripts/submit-store.mjs` — wrapper that validates the config and calls EAS
- `eas.json` — submit profiles (set up in cluster 6 Task 2)

## Required secrets

These environment variables (or GitHub Actions secrets) must be set before `npm run submit:store` will succeed:

**App Store (Apple)**
- `ASC_API_KEY_ID` — the Key ID from App Store Connect (e.g. `ABCD123456`)
- `ASC_API_ISSUER_ID` — the Issuer ID from App Store Connect (UUID)
- `ASC_API_KEY_PATH` — local filesystem path to the `.p8` private key file

**Play Store (Google)**
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PATH` — local filesystem path to the service-account JSON for the Play Console API

Generate the App Store API key under App Store Connect → Users and Access → Keys → App Store Connect API. The service-account JSON for Play comes from Google Cloud Console → IAM → Service Accounts → Keys → Add Key.

## Editing the config

`store.config.json` ships with `{{placeholder}}` tokens. Replace them per app:

- `{{appName}}` — display name (App Store + Play title)
- `{{subtitle}}` — App Store subtitle (max 30 chars)
- `{{shortDescription}}` — Play short description (max 80 chars)
- `{{description}}` — full description (App Store: 4000 chars, Play: 4000 chars)
- `{{keyword1}}`, `{{keyword2}}`, `{{keyword3}}` — App Store keywords (comma-separated in field, total max 100 chars)
- `{{marketingUrl}}`, `{{supportUrl}}`, `{{privacyPolicyUrl}}` — required URLs
- `{{primaryCategory}}`, `{{secondaryCategory}}` — App Store categories (e.g. `LIFESTYLE`, `PRODUCTIVITY`)
- `{{playCategory}}` — Play category type (e.g. `LIFESTYLE`)
- `{{contactEmail}}`, `{{contactPhone}}`, `{{contactWebsite}}` — Play contact details
- `{{owner}}` — company / legal entity name
- `{{year}}` — copyright year

Add more locales by adding entries to `apple.info` and `googlePlay.info` under their locale keys (`en-US`, `es-ES`, `fr-FR`, etc.).

## Running it

# Dry run (prints commands, doesn't invoke eas)
npm run submit:store -- --platform all --dry-run

# Submit just iOS
npm run submit:store -- --platform ios

# Submit just Android with the staging profile
npm run submit:store -- --platform android --profile staging

# Full both-platforms production submission
npm run submit:store -- --platform all

The script validates `store.config.json` is parseable JSON, then runs:

1. `eas submit --platform <ios|android> --profile <profile> --non-interactive`
2. `eas metadata:push --profile <profile>`

## What this does NOT cover

- **Screenshots.** EAS Submit does not push screenshots from the config. Operator uploads screenshots manually via the App Store Connect / Play Console UI for now. Future cluster will add screenshot-automation via Maestro.
- **Pricing / availability.** Manage in store consoles.
- **App rejection appeals.** Manage in store consoles.
- **TestFlight tester groups.** Manage via `eas submit --profile staging` (handles internal-testing track), then ASC for external tester groups.

## Common rejections to pre-empt

- **App Tracking Transparency disclosure missing.** If you use any tracking SDK (PostHog with `captureExternalUserId`, Sentry with user context, etc.), declare the tracking purposes in the App Store privacy nutrition labels. The template's `ConsentBanner` already gates analytics until the user grants consent — surface that flow in your App Store privacy questionnaire.
- **Sign-in-with-Apple required.** If you offer ANY third-party sign-in (Google, Facebook, etc.), you must also offer Sign-in-with-Apple. Cluster 5 ships `services/apple-auth.ts` for this — wire it through your sign-in screens.
- **Account deletion.** App Store requires apps with account creation to also support in-app account deletion. Cluster 2 ships an account-deletion flow — make sure it's surfaced in Settings.