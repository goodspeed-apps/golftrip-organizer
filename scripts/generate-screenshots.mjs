#!/usr/bin/env node
/**
 * generate-screenshots.mjs
 *
 * Orchestrates Maestro-based screenshot capture and Sharp-based resize for
 * App Store (iOS) and Play Store (Android) required sizes.
 *
 * Usage:
 *   node scripts/generate-screenshots.mjs [options]
 *
 * Options:
 *   --platform ios|android|all   Which platform to generate (default: all)
 *   --locales <csv>              Comma-separated locale codes (default: en-US)
 *   --out <dir>                  Output root directory (default: screenshots/)
 *   --skip-capture               Skip Maestro; resize existing _raw/ files only
 *   --help                       Print this help text and exit
 *
 * See docs/SCREENSHOTS.md for the full operator guide.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IOS_SIZES,
  ANDROID_SIZES,
  PLATFORM_SIZES,
  FLOWS,
  parseArgs,
  outputPath,
  resizeForPlatform,
} from './generate-screenshots-helpers.ts';

export { IOS_SIZES, ANDROID_SIZES, PLATFORM_SIZES, FLOWS, parseArgs, outputPath, resizeForPlatform };

const FLOW_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.maestro/screenshots',
);

function printHelp() {
  console.log(`
generate-screenshots.mjs — App Store / Play Store screenshot pipeline

Usage:
  node scripts/generate-screenshots.mjs [options]

Options:
  --platform ios|android|all   Platform to generate screenshots for (default: all)
  --locales <csv>              Comma-separated locale codes (default: en-US)
  --out <dir>                  Output root directory (default: screenshots/)
  --skip-capture               Skip Maestro capture; resize existing _raw/ files only
  --help                       Print this help and exit

Required tools (for capture step):
  - Maestro CLI  https://maestro.mobile.dev/getting-started/installing-maestro
  - A running iOS Simulator or Android Emulator with MAESTRO_APP_ID set

Output structure:
  screenshots/{platform}/{size}/{order}-{name}.png

iOS sizes:
  6.7-inch  (1290 x 2796)
  5.5-inch  (1242 x 2208)

Android sizes:
  phone           (1080 x 1920)
  7-inch-tablet   (1200 x 1920)
  10-inch-tablet  (1600 x 2560)

See docs/SCREENSHOTS.md for the full operator guide.
`.trim());
}

// ─── Maestro availability check ──────────────────────────────────────────────

export function isMaestroAvailable() {
  try {
    const result = spawnSync('maestro', ['--version'], { encoding: 'utf8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

// ─── Capture step ─────────────────────────────────────────────────────────────

/**
 * Runs a single Maestro flow and returns the path of the captured raw PNG.
 * rawDir is the directory where Maestro will write the screenshot.
 */
export function runMaestroFlow(flowFile, rawDir, platform, env = process.env) {
  const appId = env.MAESTRO_APP_ID;
  if (!appId) {
    throw new Error(
      'MAESTRO_APP_ID is not set. Export it before running: export MAESTRO_APP_ID=com.example.app',
    );
  }

  fs.mkdirSync(rawDir, { recursive: true });

  const cmd = [
    'maestro',
    'test',
    flowFile,
    `--env=MAESTRO_APP_ID=${appId}`,
    `--env=MAESTRO_PLATFORM=${platform}`,
  ].join(' ');

  console.log(`  [maestro] ${path.basename(flowFile)}`);
  execSync(cmd, { stdio: 'inherit', env: { ...env } });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const platforms =
    opts.platform === 'all' ? ['ios', 'android'] : [opts.platform];

  for (const p of platforms) {
    if (!PLATFORM_SIZES[p]) {
      console.error(`Unknown platform "${p}". Use: ios, android, all`);
      process.exit(1);
    }
  }

  // Step 1: Capture
  if (!opts.skipCapture) {
    if (!isMaestroAvailable()) {
      console.error(
        '\nMaestro CLI not found.\n' +
        'Install it with: curl -Ls "https://get.maestro.mobile.dev" | bash\n' +
        'See docs/SCREENSHOTS.md for the full setup guide.',
      );
      process.exit(1);
    }

    for (const platform of platforms) {
      console.log(`\nCapturing ${platform} screenshots...`);
      const rawDir = path.join(opts.out, '_raw', platform);

      for (const flow of FLOWS) {
        const flowFile = path.join(FLOW_DIR, `${flow.order}-${flow.name}.yaml`);
        if (!fs.existsSync(flowFile)) {
          console.warn(`  [warn] Flow not found, skipping: ${flowFile}`);
          continue;
        }
        runMaestroFlow(flowFile, rawDir, platform);
      }
    }
  }

  // Step 2 + 3: Resize and write
  let hasErrors = false;
  for (const platform of platforms) {
    console.log(`\nResizing ${platform} screenshots...`);
    const rawDir = path.join(opts.out, '_raw', platform);

    for (const flow of FLOWS) {
      const srcPath = path.join(rawDir, `${flow.order}-${flow.name}.png`);
      try {
        await resizeForPlatform(srcPath, platform, opts.out, flow.order, flow.name);
      } catch (err) {
        console.error(`  [error] ${err.message}`);
        hasErrors = true;
      }
    }
  }

  // Step 4: Clean up _raw/ after successful resize
  if (!hasErrors) {
    const rawRoot = path.join(opts.out, '_raw');
    if (fs.existsSync(rawRoot)) {
      fs.rmSync(rawRoot, { recursive: true, force: true });
      console.log('\nCleaned up _raw/ directory.');
    }
    console.log('\nScreenshots complete.');
  } else {
    console.error('\nSome screenshots failed. Check errors above. _raw/ retained for inspection.');
    process.exit(1);
  }
}

// Run only when executed directly (not when imported by tests).
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
