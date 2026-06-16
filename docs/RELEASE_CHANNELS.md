# Release Channels

GAS Template uses three EAS Update branches to separate dev/test traffic from
production. Each channel maps to a build profile in `eas.json` and receives
independent JS-only over-the-air (OTA) updates.

---

## Channels

- **preview** — ephemeral PR builds and quick internal iteration. Internal
  distribution only; never reaches external testers or stores.
- **staging** — pre-release candidate builds sent to TestFlight (internal +
  external testers) and Google Play internal track. Gate for QA sign-off before
  production.
- **production** — live App Store and Google Play production track builds.
  Only promote here after staging QA passes.

---

## First-Time Setup

Run once per project after cloning:

eas update:configure

This creates the three branches on EAS and writes the channel names into
`app.json` (or `app.config.js`). Commit the resulting changes.

---

## Building Per Channel

# Internal preview build (no store submit)
eas build --profile preview --platform all

# Staging build (sends to TestFlight + Play internal)
eas build --profile staging --platform all

# Production build (App Store + Play production)
eas build --profile production --platform all

Submit credentials are picked up automatically from `eas.json` submit profiles.
Required secrets: `ASC_APPLE_ID`, `ASC_APP_ID`, `APPLE_TEAM_ID`.
See the RUNBOOK required-secrets list.

---

## Publishing a JS-Only OTA Update

JS-only updates (no native code changes) can be pushed without a new build:

eas update --branch production --message "fix: correct typo on home screen"

Replace `production` with `preview` or `staging` as appropriate.
OTA updates only deliver the JS bundle; they cannot upgrade the native runtime
version. Any change requiring a new `runtimeVersion` must go through a full
`eas build`.

---

## Rollback Procedure

If a bad update reaches a channel, republish the last known-good update.

**Step 1 — Find the prior update ID:**

eas update:list --branch production

This lists recent updates with their IDs and messages. Identify the ID of the
last good update.

**Step 2 — Republish that update as the new HEAD:**

eas update --branch production --republish <prior-update-id> --message "rollback: <reason>"

EAS immediately serves that update to all clients on the production channel.
No new build is required.

For staging rollbacks, replace `production` with `staging`.

---

## Bumping the Minimum Runtime Version

`gasConfig.app.minRuntimeVersion` (in `gas.config.ts`) is the semver floor
clients must meet. `MinVersionGate` blocks the app tree for any client running
below this version and prompts the user to update from the App Store.

**When to bump:**

- A new native module was added that older bundles cannot call.
- A breaking change in the JS-native bridge was made.
- Any Expo SDK upgrade that changes the runtime ABI.

**How to bump:**

1. Update `minRuntimeVersion` in `gas.config.ts`:

   ```ts
   minRuntimeVersion: '2.0.0',
   

2. Run a new `eas build` for all affected channels. JS-only OTA updates cannot
   deliver a new runtime, so a build is mandatory.

3. Submit the new build to the stores / TestFlight as normal.

4. Once the new build is live, clients on the old runtime will see the
   "Update Required" modal until they install the new version.

---

## Channel to Store Mapping

- **preview** — ephemeral PR builds, internal distribution only
- **staging** — TestFlight (internal + external testers) and Google Play
  internal track
- **production** — App Store production release and Google Play production
  track