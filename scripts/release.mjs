#!/usr/bin/env node

/**
 * GAS Template — Release Script
 *
 * Runs type-check → smoke tests → EAS OTA publish.
 * Usage: node scripts/release.mjs "release message"
 */

import { execSync } from 'node:child_process';

const message = process.argv[2] || 'OTA update';
const dryRun = process.argv.includes('--dry-run');

function run(cmd, label) {
  console.log(`\n▸ ${label}...`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`  ✓ ${label} passed`);
    return true;
  } catch {
    console.error(`  ✗ ${label} failed`);
    return false;
  }
}

console.log(`\n━━━ GAS Release: "${message}" ━━━\n`);

// Gate 1: Type check
if (!run('npx tsc --noEmit', 'Type check')) {
  console.error('\n⛔ Release blocked: fix type errors first.\n');
  process.exit(1);
}

// Gate 2: All tests
if (!run('npx jest', 'Tests')) {
  console.error('\n⛔ Release blocked: fix failing tests first.\n');
  process.exit(1);
}

// Gate 3: OTA publish (skip in dry-run mode)
if (dryRun) {
  console.log('\n✅ Dry run succeeded — all gates passed. No OTA published.\n');
  process.exit(0);
}

if (!process.env.EXPO_TOKEN && !process.env.EAS_TOKEN) {
  console.error('\n⛔ EXPO_TOKEN or EAS_TOKEN env var not set. Cannot publish OTA.\n');
  process.exit(1);
}

console.log('\n▸ Publishing OTA update...');
try {
  execSync(`npx eas update --branch preview --message "${message}"`, {
    stdio: 'inherit',
  });
  console.log('\n✅ Release published successfully!\n');
} catch {
  console.error('\n⛔ EAS update failed. Check your EAS configuration.\n');
  process.exit(1);
}
