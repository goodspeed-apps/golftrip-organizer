#!/usr/bin/env node

/**
 * GAS Template — Store Submission
 *
 * Wraps `eas submit` and `eas metadata:push` for App Store + Play Store releases.
 * Reads store.config.json for metadata, then invokes EAS CLI with the chosen platform profile.
 *
 * Usage:
 *   node scripts/submit-store.mjs --platform ios
 *   node scripts/submit-store.mjs --platform android
 *   node scripts/submit-store.mjs --platform all
 *   node scripts/submit-store.mjs --platform all --dry-run
 *   node scripts/submit-store.mjs --help
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const HELP = `
GAS Store Submit — wraps EAS Submit + EAS Metadata.

Usage:
  npm run submit:store -- --platform <ios|android|all> [--dry-run] [--profile <name>]

Options:
  --platform   ios | android | all (required)
  --profile    eas.json submit profile (default: production)
  --dry-run    print the commands without invoking eas
  --help       show this help

Required env / secrets:
  ASC_API_KEY_ID, ASC_API_ISSUER_ID, ASC_API_KEY_PATH  (App Store)
  GOOGLE_PLAY_SERVICE_ACCOUNT_PATH                     (Play Store)

See docs/STORE_METADATA.md for the full operator runbook.
`.trim();

function parseArgs(argv) {
  const opts = { platform: null, profile: 'production', dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--platform') opts.platform = argv[++i];
    else if (a.startsWith('--platform=')) opts.platform = a.slice('--platform='.length);
    else if (a === '--profile') opts.profile = argv[++i];
    else if (a.startsWith('--profile=')) opts.profile = a.slice('--profile='.length);
    else if (a === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help || !opts.platform) {
  console.log(HELP);
  process.exit(opts.help ? 0 : 1);
}

if (!['ios', 'android', 'all'].includes(opts.platform)) {
  console.error(`⛔ Unknown --platform value: ${opts.platform}. Expected ios | android | all.`);
  process.exit(1);
}

if (!existsSync('store.config.json')) {
  console.error('⛔ store.config.json not found in cwd. Run from the repo root.');
  process.exit(1);
}

try {
  JSON.parse(readFileSync('store.config.json', 'utf8'));
} catch (e) {
  console.error(`⛔ store.config.json is invalid JSON: ${e.message}`);
  process.exit(1);
}

const platforms = opts.platform === 'all' ? ['ios', 'android'] : [opts.platform];

function run(cmd) {
  console.log(`▸ ${cmd}`);
  if (opts.dryRun) return;
  execSync(cmd, { stdio: 'inherit' });
}

console.log(`\n━━━ GAS Store Submit ━━━`);
console.log(`▸ Platforms: ${platforms.join(', ')}`);
console.log(`▸ Profile:   ${opts.profile}`);
if (opts.dryRun) console.log(`▸ Mode:      --dry-run (no eas commands will execute)\n`);
else console.log();

for (const p of platforms) {
  run(`eas submit --platform ${p} --profile ${opts.profile} --non-interactive`);
}

run(`eas metadata:push --profile ${opts.profile}`);

console.log(`\n✅ Store submission flow complete.\n`);
