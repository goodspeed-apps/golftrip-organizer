#!/usr/bin/env node

/**
 * GAS Template — Bundle Size Check
 *
 * Runs expo export for web, sums the output, and fails if over the budget
 * defined in gas.config.ts (performance.maxBundleSizeMB, default 8 MB).
 *
 * Usage: node scripts/check-bundle-size.mjs
 *        npm run check-bundle
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_OUTPUT_DIR = '.perf-build';
const DEFAULT_MB = 8;

// ─── CLI args ─────────────────────────────────────────────────────────────────

/** Minimal arg parser: --skip-export, --output-dir <path>. */
function parseArgs(argv) {
  const opts = { skipExport: false, outputDir: DEFAULT_OUTPUT_DIR };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip-export') {
      opts.skipExport = true;
    } else if (a === '--output-dir') {
      const val = argv[i + 1];
      if (!val) {
        process.stderr.write('⚠️  --output-dir requires a path argument.\n');
        process.exit(2);
      }
      opts.outputDir = val;
      i++;
    } else if (a.startsWith('--output-dir=')) {
      opts.outputDir = a.slice('--output-dir='.length);
    }
  }
  return opts;
}

const { skipExport, outputDir: OUTPUT_DIR } = parseArgs(process.argv.slice(2));

/** Regex-parse maxBundleSizeMB from gas.config.ts — file is not importable from plain Node. */
function readThreshold() {
  try {
    const src = readFileSync('gas.config.ts', 'utf8');
    const match = src.match(/maxBundleSizeMB\s*:\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    process.stderr.write(
      `⚠️  gas.config.ts has no maxBundleSizeMB — falling back to ${DEFAULT_MB} MB. Set performance.maxBundleSizeMB explicitly.\n`,
    );
  } catch {
    process.stderr.write(`⚠️  Could not read gas.config.ts — falling back to ${DEFAULT_MB} MB.\n`);
  }
  return DEFAULT_MB;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively sum all file sizes under a directory. */
function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeBytes(full);
    } else {
      total += statSync(full).size;
    }
  }
  return total;
}

function cleanup() {
  // Only clean up the directory we own (default). If a caller passes
  // --output-dir explicitly (e.g. CI pointing at /tmp/export-check), leave
  // it alone — they manage its lifecycle.
  if (OUTPUT_DIR === DEFAULT_OUTPUT_DIR && existsSync(OUTPUT_DIR)) {
    rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const thresholdMB = readThreshold();

console.log('\n━━━ GAS Bundle Size Check ━━━\n');
console.log(`▸ Budget: ${thresholdMB} MB`);
if (skipExport) {
  console.log(`▸ Mode: --skip-export (measuring existing ${OUTPUT_DIR})`);
}

cleanup();

try {
  if (skipExport) {
    if (!existsSync(OUTPUT_DIR)) {
      console.error(
        `\n⛔ --skip-export was set but ${OUTPUT_DIR} does not exist. ` +
        `Run expo export before invoking this script with --skip-export.\n`,
      );
      process.exit(1);
    }
  } else {
    console.log(`\n▸ Running expo export (web)...`);
    try {
      execSync(
        `npx expo export --platform web --output-dir ${OUTPUT_DIR}`,
        { stdio: ['ignore', 'inherit', 'pipe'] },
      );
    } catch (exportErr) {
      // Template-mode skip: expo export can't run without a real project configured.
      // Capture stderr + message to detect known template-only failures.
      const stderr = exportErr?.stderr?.toString() ?? '';
      const msg = String(exportErr?.message ?? '');
      const combined = stderr + msg;

      // Template-mode is narrow: app.config.js requires gas.config.ts which Node can't
      // import directly in the bare template (DevAgent provisions the build pipeline).
      // GAS_REQUIRE_BUNDLE_CHECK=1 disables this skip so DevAgent-generated apps fail
      // on real bundle problems instead of silently passing.
      const requireBundleCheck = process.env.GAS_REQUIRE_BUNDLE_CHECK === '1';
      const isTemplateFailure = !requireBundleCheck && (
        /Cannot find module ['"][.\/]*gas\.config['"]?/.test(combined) ||
        combined.includes('require() of ES Module') ||
        !existsSync('node_modules')
      );

      if (isTemplateFailure) {
        // Print stderr so the skip reason is visible
        if (stderr) process.stderr.write(stderr);
        console.log(
          '\n  — template-mode skip: expo export cannot run in the uninstalled template directory.',
        );
        console.log('    This check will run normally in a provisioned app.\n');
        process.exit(0);
      }

      // Real failure — print captured stderr then re-throw
      if (stderr) process.stderr.write(stderr);
      throw exportErr;
    }
  }

  // Measure
  const bytes = dirSizeBytes(OUTPUT_DIR);
  const mb = bytes / (1024 * 1024);
  const over = mb > thresholdMB;

  const label = over ? '✗' : '✓';
  console.log(`\nBundle size: ${mb.toFixed(2)} MB / ${thresholdMB} MB limit ${label}`);

  if (over) {
    console.error(
      `\n⛔ Bundle exceeds budget by ${(mb - thresholdMB).toFixed(2)} MB. ` +
      `Reduce bundle size or raise performance.maxBundleSizeMB in gas.config.ts.\n`,
    );
    process.exit(1);
  }

  console.log('\n✅ Bundle size within budget.\n');
} finally {
  cleanup();
}
