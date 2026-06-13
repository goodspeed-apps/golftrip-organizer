# Screenshots

This runbook covers the screenshot automation pipeline: Maestro captures frames from a running simulator/emulator Sharp resizes them to every required store size and store.config.json points EAS Submit at the generated files

## Overview

1. **Capture** five Maestro flows (home signup paywall profile settings) run against a live simulator/emulator and save raw PNGs to `screenshots/_raw/{platform}/`
2. **Resize** `scripts/generate-screenshots.mjs` uses Sharp to resize each raw frame to all required dimensions and writes the results to `screenshots/{platform}/{size}/{order}-{name}.png`
3. **Submit** `store.config.json` references the generated paths `pnpm submit:store` (cluster 6) picks them up automatically

Required store sizes

- **iOS 6.7-inch** 1290 x 2796 (iPhone 15 Pro Max mandatory)
- **iOS 5.5-inch** 1242 x 2208 (iPhone 8 Plus mandatory)
- **Android phone** 1080 x 1920
- **Android 7-inch tablet** 1200 x 1920
- **Android 10-inch tablet** 1600 x 2560

---

## Required Tools

- **Maestro CLI** https://maestro.mobile.dev/getting-started/installing-maestro  
Install: `curl -Ls "https://get.maestro.mobile.dev" | bash`
- **Node 20+** `node --version`
- **pnpm 10+** `pnpm --version`
- **sharp** installed as a devDependency via `pnpm install`

---

## Local Run

1. Boot a simulator (iOS) or emulator (Android) and install your dev build
2. Set the app bundle ID  
export MAESTRO_APP_ID=com.example.myapp
3. Run the pipeline  
pnpm screenshots
# or with options:
pnpm screenshots -- --platform ios --locales en-US
4. Inspect output under `screenshots/`
5. Commit the generated PNGs when satisfied

### CLI options

- `--platform ios|android|all` (default: all)
- `--locales <csv>` comma-separated locales (default: en-US)
- `--out <dir>` output root directory (default: screenshots/)
- `--skip-capture` skip Maestro; only resize existing `_raw/` files
- `--help` print usage and exit

---

## Authoring a New Flow

1. Copy an existing flow from `.maestro/screenshots/` as a starting point
2. Name it `{NN}-{screen-name}.yaml` where `NN` is the next available two-digit order number
3. Replace the TODO navigation steps with your app-specific Maestro commands  
   - Use `tapOn` `inputText` `openLink` etc to reach the target screen  
   - Use `waitForAnimationToEnd` before `takeScreenshot` so animations settle
4. Keep the `takeScreenshot` line pointing to `screenshots/_raw/${MAESTRO_PLATFORM}/{NN}-{screen-name}`
5. Add the new flow to the `FLOWS` array in `scripts/generate-screenshots.mjs`
6. Add matching paths to `store.config.json` under `apple.info.en-US.screenshots` and `googlePlay.info.en-US.graphics`

---

## Updating Flows When UI Changes

1. Re-run `pnpm screenshots`
2. Review the diff in `screenshots/` with your image viewer or `git diff --stat`
3. If the new frames look correct commit them
4. If a flow breaks due to navigation changes update the YAML selectors and re-run

---

## Common Gotchas

**Status bar variation** On iOS simulators the status bar may show a real clock Use Simulator > Device > Override Status Bar to freeze it or crop it out in the flow

**Dark mode toggle** Flows run in the simulator's current appearance Set appearance explicitly before running: `xcrun simctl ui booted appearance light`

**Dynamic type scaling** Large Accessibility text sizes can overflow layouts Verify flows pass at default text size then test at larger sizes separately

**Animation timing** Increase `waitForAnimationToEnd` timeout (default 3000 ms) for screens with complex entrance animations or network fetches A too-short wait produces mid-animation frames

**`_raw/` not cleaned up** If any resize step fails `_raw/` is retained for inspection Fix the error and re-run (or use `--skip-capture` to skip re-capturing)

**Missing `MAESTRO_APP_ID`** The script exits early with a clear error if this env var is not set Always export it before running

---

## Adding Additional Locales

1. Duplicate each flow YAML and add a locale env var if your app switches language based on an env or deep link Otherwise run the same flows after switching the simulator locale via System Preferences
2. Pass the locale to the script  
pnpm screenshots -- --locales en-US,fr-FR
3. Add locale-specific paths to `store.config.json` under the matching locale key (e.g `apple.info.fr-FR.screenshots`)

---

## CI Run

The `screenshots` workflow is `workflow_dispatch` only - it is not triggered by pushes or PRs because Maestro flows are slow and require a running simulator

To run it:

1. Go to Actions > Screenshots in your GitHub repository
2. Click "Run workflow"
3. Select the platform (ios android or all)
4. After the job completes download the `screenshots-{platform}` artifact as a zip

The workflow uses `secrets.MAESTRO_APP_ID` - add this secret to your repository before the first run

---

## Integration with EAS Submit

`store.config.json` references the generated paths under

- `apple.info.en-US.screenshots.iphone6_7` and `iphone5_5`
- `googlePlay.info.en-US.graphics.phoneScreenshots` `sevenInchScreenshots` `tenInchScreenshots`

`pnpm submit:store` (from cluster 6) reads this config and passes the files to EAS Submit Ensure the `screenshots/` directory is committed or present before running the submit command