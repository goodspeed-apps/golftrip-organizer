#!/usr/bin/env node
/**
 * GAS Template — Brand Token Drift Linter
 *
 * Scans app/ and components/ for hardcoded brand-palette hex colors and
 * fontFamily string literals that should be routed through theme tokens.
 *
 * Exits non-zero and lists offenders if any are found.
 *
 * Exclusions:
 *   - Avatar.tsx palette (intentionally stable — user-identity colors)
 *   - Neutral colors: #FFFFFF, #000000, #00000088, rgba(0,0,0,...)
 *   - In-code comments
 *
 * Run:  node scripts/check-brand-tokens.mjs
 * Gate: npm run lint:brand
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// ─── Brand/semantic palette to flag ──────────────────────────────────────────
// Sourced from gas.config.js design.colors. Update when the config changes.
const BRAND_HEX = [
  '#6366F1', // primary
  '#818CF8', // primaryDark
  '#8B5CF6', // secondary
  '#06B6D4', // accent
  '#10B981', // success
  '#F59E0B', // warning
  '#EF4444', // error
  // Common case-insensitive variants
  '#6366f1',
  '#818cf8',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  // Partial match with alpha suffix — catch '#EF444415' style too
];

// These match hex strings with optional 2-char alpha suffix (#RRGGBBAA)
const BRAND_HEX_RE = new RegExp(
  `('|")(${[
    '#6366[Ff]1',
    '#818[Cc][Ff]8',
    '#8[Bb]5[Cc][Ff]6',
    '#06[Bb]6[Dd]4',
    '#10[Bb]981',
    '#[Ff]59[Ee]0[Bb]',
    '#[Ee][Ff]4444',
  ].join('|')})[0-9A-Fa-f]{0,2}\\1`,
  'g',
);

// ─── Font families to flag ────────────────────────────────────────────────────
// Matches fontFamily: '<SomeLiteralFontName>' that is NOT 'monospace' or 'system'
// (those are sentinels; 'monospace' is routed through monoFamily() now).
// We also want to catch any remaining hard-coded 'monospace' strings in fontFamily.
const FONT_FAMILY_RE = /fontFamily:\s*['"][A-Za-z][A-Za-z0-9_ ]+['"]/g;

// ─── Files / directories to skip ─────────────────────────────────────────────
const SKIP_FILES = new Set([
  // Avatar palette is intentionally stable — documented with a comment in the file.
  'components/ui/Avatar.tsx',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  '.expo',
  'dist',
  '__tests__',
  '__mocks__',
]);

// Font families that are NOT treated as offenders even if hardcoded.
// 'system' and 'monospace' are OS sentinels, not brand decisions.
const ALLOWED_FONT_FAMILIES = new Set(['system', 'monospace']);

// ─── Walker ──────────────────────────────────────────────────────────────────

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// ─── Checker ─────────────────────────────────────────────────────────────────

/** Strip comments before scanning so commented-out code doesn't fire. */
function stripComments(src) {
  // Remove block comments (including JSDoc /** ... */) first, then inline // comments.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function checkFile(filePath) {
  const rel = relative(ROOT, filePath);
  if (SKIP_FILES.has(rel)) return [];

  const raw = readFileSync(filePath, 'utf8');
  const src = stripComments(raw);
  const lines = raw.split('\n');

  const findings = [];

  // Check brand hex
  for (const [lineIdx, line] of lines.entries()) {
    const strippedLine = stripComments(line);
    let m;
    BRAND_HEX_RE.lastIndex = 0;
    while ((m = BRAND_HEX_RE.exec(strippedLine)) !== null) {
      findings.push({
        file: rel,
        line: lineIdx + 1,
        kind: 'brand-hex',
        value: m[0],
        snippet: line.trim().slice(0, 80),
      });
    }
  }

  // Check fontFamily literals
  for (const [lineIdx, line] of lines.entries()) {
    const strippedLine = stripComments(line);
    let m;
    FONT_FAMILY_RE.lastIndex = 0;
    while ((m = FONT_FAMILY_RE.exec(strippedLine)) !== null) {
      // Extract the family value from fontFamily: 'Foo'
      const valueMatch = m[0].match(/['"]([^'"]+)['"]\s*$/);
      if (!valueMatch) continue;
      const family = valueMatch[1];
      if (ALLOWED_FONT_FAMILIES.has(family)) continue;
      findings.push({
        file: rel,
        line: lineIdx + 1,
        kind: 'hardcoded-font',
        value: m[0],
        snippet: line.trim().slice(0, 80),
      });
    }
  }

  return findings;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const appDir = join(ROOT, 'app');
const componentsDir = join(ROOT, 'components');

const files = [...walk(appDir), ...walk(componentsDir)];
const allFindings = files.flatMap(checkFile);

if (allFindings.length === 0) {
  console.log('check-brand-tokens: PASS — no hardcoded brand hex or font families found.');
  process.exit(0);
} else {
  console.error(`check-brand-tokens: FAIL — ${allFindings.length} offender(s) found:\n`);
  for (const f of allFindings) {
    const label = f.kind === 'brand-hex' ? 'brand-hex  ' : 'font-family';
    console.error(`  [${label}] ${f.file}:${f.line}  ${f.value}`);
    console.error(`            ${f.snippet}`);
  }
  console.error('\nReplace each with the matching colors.* token or displayFamily()/bodyFamily()/monoFamily() from lib/fonts.ts.');
  process.exit(1);
}
