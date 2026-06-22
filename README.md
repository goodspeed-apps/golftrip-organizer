# GolfTrip Organizer

Forked from your Goodspeed Studio export. This is a plain Expo project. There are no Goodspeed runtime dependencies, no proprietary APIs, and no remote callbacks. You own it.

## Setup

```bash
pnpm install
cp .env.example .env
# Fill in your own Supabase, PostHog, Sentry, RevenueCat keys
pnpm start
```

## Build (EAS)

```bash
npx eas-cli build --platform ios
npx eas-cli build --platform android
```

## What you got

- `app/` — Expo Router screens
- `components/`, `hooks/`, `lib/` — shared UI and helpers
- `services/` — API layer (Supabase client by default)
- `supabase/migrations/` — database schema
- `gas.config.ts` — your app architecture as a plain JSON object (informational, safe to delete)
- `app.config.js`, `eas.json`, `package.json` — standard Expo + EAS configuration

Note: Goodspeed's internal CI workflows (`.github/workflows`) are not included; they are tied to our CI setup. Add your own CI if you want it.

## Slug

`golftrip-organizer`
