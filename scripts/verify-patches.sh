#!/usr/bin/env bash
# verify-patches.sh — sanity-check the PAC-workaround patch stack after install.
#
# Runs after `pnpm install` (or `npm install`) and confirms every patch in
# patches/ actually applied to node_modules and the embedded-bundle plugin
# is wired into app.config.js. Fails fast in CI before a 20-minute EAS build.
#
# The patches collectively keep generated apps from crashing on iOS 26 / iPhone
# 17 Pro:
#   - expo+55.0.24.patch          — TPL-028, forces APP_DEBUG=NO in EXAppDefinesLoader
#   - expo-updates+55.0.22.patch  — TPL-029/030, MODE=all on update resources + finish() assert downgraded
#   - react-native+0.83.6.patch   — PAC-safe Hermes interop
#   - @supabase+supabase-js+...   — Edge-runtime / dev compat
# Plus plugins/with-force-embedded-bundle.js which disables RCTDevLoadingView
# and the shake-to-show dev menu at native runtime.
#
# Exit codes: 0 ok, 1 missing patches, 2 patches present but not applied,
#             3 plugin not wired, 4 post-install hook missing.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail() { echo "verify-patches: FAIL — $1" >&2; exit "$2"; }

# 1. Every patch file exists.
required_patches=(
  "expo+55.0.24.patch"
  "expo-updates+55.0.22.patch"
  "react-native+0.83.6.patch"
  "@supabase+supabase-js+2.106.0.patch"
)
for p in "${required_patches[@]}"; do
  [[ -f "$ROOT/patches/$p" ]] || fail "missing patches/$p" 1
done

# 2. patch-package post-install hook present in package.json.
grep -q '"eas-build-post-install": "npx patch-package"' "$ROOT/package.json" \
  || fail "eas-build-post-install hook missing in package.json (patches will not apply on EAS Build)" 4
grep -q '"postinstall": "patch-package"' "$ROOT/package.json" \
  || fail "postinstall hook missing in package.json (patches will not apply locally)" 4

# 3. embedded-bundle plugin wired into app.config.js.
grep -q "./plugins/with-force-embedded-bundle" "$ROOT/app.config.js" \
  || fail "with-force-embedded-bundle plugin not registered in app.config.js" 3

# 4. plugin contains the dev-menu kill-switch (TPL-031 equivalent).
grep -q "isShakeToShowDevMenuEnabled = false" "$ROOT/plugins/with-force-embedded-bundle.js" \
  || fail "plugins/with-force-embedded-bundle.js missing dev-menu kill-switch" 3

# 5. Patches actually applied in node_modules (only if node_modules present).
if [[ -d "$ROOT/node_modules" ]]; then
  # Sentinel: TPL-028 forces APP_DEBUG=NO in EXAppDefinesLoader.m
  defines="$ROOT/node_modules/expo/ios/Expo/EXAppDefinesLoader.m"
  if [[ -f "$defines" ]]; then
    grep -q '#define APP_DEBUG NO' "$defines" \
      || fail "TPL-028 not applied: APP_DEBUG=NO not present in $(basename "$defines") — apps WILL crash on iPhone 17 Pro" 2
  fi

  # Sentinel: TPL-029 update-resources script forced to MODE=all
  res_script="$ROOT/node_modules/expo-updates/scripts/create-updates-resources-ios.sh"
  if [[ -f "$res_script" ]]; then
    grep -q 'MODE=all' "$res_script" \
      || fail "TPL-029 not applied: create-updates-resources-ios.sh missing MODE=all — embedded manifest will be missing on cold launch" 2
  fi
fi

echo "verify-patches: OK — all patches present, hooks wired, plugin intact"
