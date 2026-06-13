#!/usr/bin/env node

/**
 * GAS Template -- i18n Coverage Check
 *
 * Extracts all t('...') keys from .ts/.tsx source files and diffs them against
 * every locales/*.json file. Missing keys in en.json cause a non-zero exit.
 * Missing keys in other locales emit a stderr warning but exit 0.
 *
 * Usage:
 *   node scripts/check-i18n-coverage.mjs
 *   node scripts/check-i18n-coverage.mjs --json
 *   node scripts/check-i18n-coverage.mjs --help
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ts-jest compiles i18n-helpers.ts at test time; at runtime we use a require
// shim so the .ts file is loaded via ts-node if available, otherwise we inline
// the logic. For production use (CI), the helpers are bundled into the .mjs
// directly to avoid a ts-node dependency.

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { json: false, help: false };
  for (const a of argv) {
    if (a === '--json') opts.json = true;
    if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

const { json: jsonMode, help } = parseArgs(process.argv.slice(2));

if (help) {
  process.stdout.write(`
GAS Template -- i18n Coverage Check

Extracts all t('...') translation keys from source files and compares them
against every locales/*.json file.

Usage:
  node scripts/check-i18n-coverage.mjs [options]

Options:
  --json    Output structured JSON to stdout (for workflow consumption)
  --help    Show this message

Exit codes:
  0   All good (or only non-en locales have missing keys)
  1   en.json is missing one or more extracted keys
  2   Unexpected error
`.trimStart());
  process.exit(0);
}

// ─── Inline helpers (mirrors i18n-helpers.ts without TypeScript) ──────────────

import {
  readFileSync,
  readdirSync,
  statSync,
  lstatSync,
  realpathSync,
} from 'node:fs';
import { join } from 'node:path';

const KEY_REGEX = /\bt\(\s*['"`]([^'"`)]+)['"`]\s*[),]/g;
const SEARCH_DIRS = ['app', 'components', 'hooks', 'lib', 'services'];
const MAX_DEPTH = 32;

function walk(dir, files = [], visited = new Set(), depth = 0) {
  if (depth > MAX_DEPTH) return files;
  let real;
  try { real = realpathSync(dir); } catch { return files; }
  if (visited.has(real)) return files;
  visited.add(real);

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let lstat;
    try { lstat = lstatSync(full); } catch { continue; }
    if (lstat.isSymbolicLink()) {
      try {
        const target = realpathSync(full);
        if (visited.has(target)) continue;
      } catch { continue; }
    }
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(full, files, visited, depth + 1);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function extractKeys(searchDirs = SEARCH_DIRS) {
  const keys = new Set();
  for (const dir of searchDirs) {
    try {
      for (const f of walk(dir)) {
        const src = readFileSync(f, 'utf8');
        KEY_REGEX.lastIndex = 0;
        let m;
        while ((m = KEY_REGEX.exec(src)) !== null) keys.add(m[1]);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  return keys;
}

function flattenKeys(obj, prefix = '') {
  const result = new Set();
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) result.add(prefix);
    return result;
  }
  for (const [key, val] of Object.entries(obj)) {
    const dotKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      for (const nested of flattenKeys(val, dotKey)) result.add(nested);
    } else {
      result.add(dotKey);
    }
  }
  return result;
}

function computeCoverage(extractedKeys, localesDir) {
  let entries;
  try {
    entries = readdirSync(localesDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const results = [];
  for (const file of entries) {
    const locale = file.replace(/\.json$/, '');
    let parsed = {};
    try {
      parsed = JSON.parse(readFileSync(join(localesDir, file), 'utf8'));
    } catch {
      // treat unreadable file as empty
    }
    const localeKeys = flattenKeys(parsed);
const missing = [];
    for (const k of extractedKeys) {
      if (!localeKeys.has(k)) missing.push(k);
    }
    missing.sort();
    results.push({ locale, missing });
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const LOCALES_DIR = 'locales';

let extractedKeys;
try {
  extractedKeys = extractKeys();
} catch (e) {
  process.stderr.write(`check-i18n-coverage: failed to extract keys: ${e.message}\n`);
  process.exit(2);
}

const coverage = computeCoverage(extractedKeys, LOCALES_DIR);

// Structured JSON output
if (jsonMode) {
  process.stdout.write(JSON.stringify({ locales: coverage }, null, 2) + '\n');
} else {
  console.log(`\n--- i18n Coverage Check ---\n`);
  console.log(`Extracted ${extractedKeys.size} key(s) from source files.`);
  for (const { locale, missing } of coverage) {
    if (missing.length === 0) {
      console.log(`  ${locale}: OK`);
    } else {
      console.log(`  ${locale}: ${missing.length} missing key(s)`);
      for (const k of missing.slice(0, 20)) console.log(`    - ${k}`);
      if (missing.length > 20) console.log(`    ...and ${missing.length - 20} more`);
    }
  }
  console.log('');
}

// Determine exit code
const enResult = coverage.find((r) => r.locale === 'en');
if (enResult && enResult.missing.length > 0) {
  process.stderr.write(
    `check-i18n-coverage: ERROR: en.json is missing ${enResult.missing.length} key(s). ` +
    `Run scripts/extract-i18n-keys.mjs to update.\n`,
  );
  process.exit(1);
}

for (const { locale, missing } of coverage) {
  if (locale !== 'en' && missing.length > 0) {
    process.stderr.write(
      `check-i18n-coverage: WARN: ${locale}.json is missing ${missing.length} key(s).\n`,
    );
  }
}
