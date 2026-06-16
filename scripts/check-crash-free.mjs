#!/usr/bin/env node

/**
 * GAS Template — Crash-Free SLO Check
 *
 * Fetches crash-free user rate from Sentry Sessions API and compares it
 * against the thresholds defined in gas.config.ts.
 *
 * Usage: node scripts/check-crash-free.mjs --env production
 *        node scripts/check-crash-free.mjs --env staging --window 7d
 *
 * Required env vars: SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
 */

import { fileURLToPath } from 'node:url';
import { readConfig, fetchCrashFreeRate, checkPerPlatform, VALID_WINDOWS } from './crash-free-helpers.ts';

// ─── Config ───────────────────────────────────────────────────────────────────

const VALID_ENVS = ['production', 'staging', 'preview'];

// ─── CLI args ─────────────────────────────────────────────────────────────────

/** Minimal arg parser: --env <env>, --window <window>. */
function parseArgs(argv) {
  const opts = { env: null, window: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env') {
      const val = argv[i + 1];
      if (!val) {
        process.stderr.write('⚠️  --env requires a value (production|staging|preview).\n');
        process.exit(2);
      }
      opts.env = val;
      i++;
    } else if (a.startsWith('--env=')) {
      opts.env = a.slice('--env='.length);
    } else if (a === '--window') {
      const val = argv[i + 1];
      if (!val) {
        process.stderr.write('⚠️  --window requires a value (24h|7d).\n');
        process.exit(2);
      }
      opts.window = val;
      i++;
    } else if (a.startsWith('--window=')) {
      opts.window = a.slice('--window='.length);
    }
  }
  return opts;
}

const args = parseArgs(process.argv.slice(2));

if (!args.env) {
  process.stderr.write('⛔ --env is required. Usage: node scripts/check-crash-free.mjs --env production\n');
  process.exit(2);
}

if (!VALID_ENVS.includes(args.env)) {
  process.stderr.write(`⛔ Invalid --env "${args.env}". Must be one of: ${VALID_ENVS.join(', ')}\n`);
  process.exit(2);
}

if (args.window && !VALID_WINDOWS.includes(args.window)) {
  process.stderr.write(`⛔ Invalid --window "${args.window}". Must be one of: ${VALID_WINDOWS.join(', ')}\n`);
  process.exit(2);
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { thresholds, window: configWindow } = readConfig();
  const statsPeriod = args.window ?? configWindow;
  const env = args.env;
  const threshold = thresholds[env];

  console.log('\n━━━ GAS Crash-Free SLO Check ━━━\n');
  console.log(`▸ Environment: ${env}`);
  console.log(`▸ Window: ${statsPeriod}`);

  const isPerPlatform = typeof threshold === 'object' && threshold !== null;

  if (isPerPlatform) {
    console.log(`▸ Threshold: iOS ${threshold.ios}% / Android ${threshold.android}% (per-platform)`);
  } else {
    console.log(`▸ Threshold: ${threshold}%`);
  }

if (
    threshold === 0 ||
    (typeof threshold === 'number' && threshold === 0) ||
    (isPerPlatform && (threshold as { ios: number; android: number }).ios === 0 && (threshold as { ios: number; android: number }).android === 0)
  ) {
    console.log(`\n✅ Crash-free SLO check disabled for "${env}" (threshold = 0). Skipping.\n`);
    process.exit(0);
  }

  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const token = process.env.SENTRY_AUTH_TOKEN;

  if (!org || !project || !token) {
    const missing = [
      !org && 'SENTRY_ORG',
      !project && 'SENTRY_PROJECT',
      !token && 'SENTRY_AUTH_TOKEN',
    ].filter(Boolean);
    process.stderr.write(`⛔ Missing required environment variables: ${missing.join(', ')}\n`);
    process.exit(2);
  }

  try {
    if (isPerPlatform) {
      // Per-platform path: fetch iOS and Android separately
      const { ok, results } = await checkPerPlatform(threshold, org, project, token, statsPeriod);

      console.log('');
      for (const r of results) {
        const label = r.ok ? '✓' : '✗';
        const rateStr = r.rate !== null ? `${r.rate.toFixed(2)}%` : 'N/A';
        console.log(`  ${r.platform.padEnd(8)}: ${rateStr} / ${r.threshold}% threshold ${label}`);
      }

      if (!ok) {
        const failing = results.filter(r => !r.ok);
        const desc = failing.map(r => {
          const rateStr = r.rate !== null ? `${r.rate.toFixed(2)}%` : 'N/A';
          return `${r.platform} ${rateStr} < ${r.threshold}%`;
        }).join(', ');
        console.error(
          `\n⛔ Crash-free SLO failed for "${env}": ${desc}. ` +
          `Check https://sentry.io/organizations/${org}/issues/ for recent crashes.\n`,
        );
        process.exit(1);
      }

      console.log('\n✅ Crash-free SLO passed (both platforms).\n');
    } else {
      // Scalar path: existing behavior
      const rate = await fetchCrashFreeRate(org, project, token, statsPeriod);

      if (rate === null) {
        process.stderr.write(
          `⚠️  crash_free_rate(user) field missing from Sentry response. ` +
          `Ensure the project has session tracking enabled.\n`,
        );
        console.log('\n✅ No crash-free data available — check skipped (no sessions reported).\n');
        process.exit(0);
      }

      const pass = rate >= threshold;
      const label = pass ? '✓' : '✗';

      console.log(`\nCrash-free rate: ${rate.toFixed(2)}% / ${threshold}% threshold ${label}`);

      if (!pass) {
        console.error(
          `\n⛔ Crash-free rate ${rate.toFixed(2)}% is below the ${threshold}% threshold for "${env}". ` +
          `Check https://sentry.io/organizations/${org}/issues/ for recent crashes.\n`,
        );
        process.exit(1);
      }

      console.log('\n✅ Crash-free SLO passed.\n');
    }
  } catch (err) {
    process.stderr.write(`\n⛔ ${err.message}\n\n`);
    process.exit(1);
  }
}
