# Maestro E2E

Maestro is a YAML-driven mobile testing framework. Runs against simulator/device/cloud.

## Install (local)

```
brew tap mobile-dev-inc/tap
brew install maestro
```

Or via curl: see https://maestro.mobile.dev/getting-started/installing-maestro

## Run a flow locally

```
# Build a dev client first
eas build --profile development --platform ios --local

# Install on simulator (drag the .app into the simulator), then:
maestro test .maestro/smoke.yaml
```

## Add a new flow

1. Copy `smoke.yaml` to `<name>.yaml`
2. Edit the YAML. Reference: https://maestro.mobile.dev/api-reference/commands
3. Run locally to verify before pushing.

## CI

`.github/workflows/e2e.yml` runs flows in Maestro Cloud on every PR + main push, opt-in via the `MAESTRO_CLOUD_API_KEY` repo secret. Without that secret, the workflow exits cleanly.

## Tips

- Use `optional: true` on assertions that depend on conditional UI (feature flags, AB tests).
- Prefer `id` selectors over `text` when components have accessibility identifiers.
- For flows that need auth, set `MAESTRO_TEST_EMAIL` / `MAESTRO_TEST_PASSWORD` in the workflow env and reference via `${MAESTRO_TEST_EMAIL}`.
