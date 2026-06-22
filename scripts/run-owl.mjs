#!/usr/bin/env node

/**
 * GAS Template — Native Visual Regression Runner
 *
 * Wraps react-native-owl test runner for iOS and Android.
 * Assumes the simulator/emulator is already booted when running in CI.
 * Boot it yourself locally before running, or use the --boot flag.
 *
 * Usage:
 *   node scripts/run-owl.mjs                  # run both platforms
 *   node scripts/run-owl.mjs --platform ios   # iOS only
 *   node scripts/run-owl.mjs --platform android
 *   node scripts/run-owl.mjs --platform all
 *   node scripts/run-owl.mjs --help
 */

import { execSync } from 'node:child_process';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PLATFORMS = ['ios', 'android', 'all'];

// ─── CLI args ─────────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(
    [
      '',
      'GAS Template — Native Visual Regression Runner',
      '',
      'Usage:',
      '  node scripts/run-owl.mjs [options]',
      '',
      'Options:',
      '  --platform <ios|android|all>  Platform to test (default: all)',
      '  --help                        Print this help message',
      '',
      'Examples:',
      '  node scripts/run-owl.mjs --platform ios',
      '  node scripts/run-owl.mjs --platform android',
      '  node scripts/run-owl.mjs',
      '',
      'Notes:',
      '  - The simulator/emulator must be booted before running locally.',
      '  - In CI, the workflow handles booting via xcrun simctl / android-emulator-runner.',
      '  - Snapshots are stored in __owl__/__snapshots__/.',
      '  - Diff threshold is 0.1% pixel difference (set in __owl__/owl.config.ts).',
      '',
    ].join('\n'),
  );
}

/** Minimal arg parser: --platform, --help. */
function parseArgs(argv) {
  const opts = { platform: 'all', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (a === '--platform') {
      const val = argv[i + 1];
      if (!val) {
        process.stderr.write('⚠️  --platform requires a value (ios|android|all).\n');
        process.exit(2);
      }
      opts.platform = val;
      i++;
    } else if (a.startsWith('--platform=')) {
      opts.platform = a.slice('--platform='.length);
    }
  }
  return opts;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!VALID_PLATFORMS.includes(args.platform)) {
  process.stderr.write(
    `⛔ Unknown platform "${args.platform}". Valid values: ios, android, all.\n`,
  );
  process.exit(2);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const platforms =
  args.platform === 'all' ? ['ios', 'android'] : [args.platform];

console.log('\n━━━ GAS Native Visual Regression ━━━\n');
console.log(`▸ Platforms: ${platforms.join(', ')}`);
console.log(`▸ Config:    __owl__/owl.config.ts`);
console.log(`▸ Snapshots: __owl__/__snapshots__/\n`);

let failed = false;

for (const platform of platforms) {
  console.log(`\n--- Running Owl tests: ${platform} ---\n`);
  try {
    execSync(`npx react-native-owl test --platform ${platform}`, {
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log(`\n✅ ${platform} visual tests passed.\n`);
  } catch {
    console.error(`\n⛔ ${platform} visual tests FAILED — check diff artifacts in __owl__/__snapshots__/.\n`);
    failed = true;
  }
}

if (failed) {
  console.error(
    '\n⛔ One or more platforms failed visual regression.\n' +
    '   Review diffs in __owl__/__snapshots__/.\n' +
    '   To update baselines: run locally, verify diffs, then commit changed snapshot files.\n',
  );
  process.exit(1);
}

console.log('\n✅ All native visual regression tests passed.\n');
