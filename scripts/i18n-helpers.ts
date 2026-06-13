/**
 * Shared helpers for scripts/check-i18n-coverage.mjs.
 *
 * Extracted into a .ts file so Jest (ts-jest) can import and unit-test them
 * without executing the top-level CLI logic in the .mjs file.
 */

import { readFileSync, readdirSync, statSync, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

// ─── Key extraction ───────────────────────────────────────────────────────────

// Requires matching closing quote+paren without an "as any" cast between,
// so `t('foo' as any)` does not become a spurious i18n key.
const KEY_REGEX = /\bt\(\s*['"`]([^'"`)]+)['"`]\s*[),]/g;
export const SEARCH_DIRS = ['app', 'components', 'hooks', 'lib', 'services'];
const MAX_DEPTH = 32;

function walk(dir: string, files: string[] = [], visited = new Set<string>(), depth = 0): string[] {
  if (depth > MAX_DEPTH) return files;
  let real: string;
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

/**
 * Extract all `t('...')` keys from .ts/.tsx files under searchDirs.
 * Returns a Set of flat string keys (not dot-notation; they come from the source as-is).
 */
export function extractKeys(searchDirs: string[] = SEARCH_DIRS): Set<string> {
  const keys = new Set<string>();
  for (const dir of searchDirs) {
    try {
      for (const f of walk(dir)) {
        const src = readFileSync(f, 'utf8');
        KEY_REGEX.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = KEY_REGEX.exec(src)) !== null) keys.add(m[1]);
      }
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  return keys;
}

// ─── Locale helpers ───────────────────────────────────────────────────────────

/**
 * Flatten a nested JSON object to dot-notation keys.
 *
 * @example
 * flattenKeys({ screens: { home: { title: 'Home' } } })
 * // => Set { 'screens.home.title' }
 */
export function flattenKeys(obj: unknown, prefix = ''): Set<string> {
  const result = new Set<string>();
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) result.add(prefix);
    return result;
  }
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const dotKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      for (const nested of flattenKeys(val, dotKey)) result.add(nested);
    } else {
      result.add(dotKey);
    }
  }
  return result;
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export interface LocaleCoverageResult {
  locale: string;
  missing: string[];
}

/**
 * Compare extracted keys against locale files in localesDir.
 * Returns one entry per locale file listing missing keys.
 */
export function computeCoverage(
  extractedKeys: Set<string>,
  localesDir: string,
): LocaleCoverageResult[] {
  let entries: string[];
  try {
    entries = readdirSync(localesDir).filter((f: string) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const results: LocaleCoverageResult[] = [];
  for (const file of entries) {
    const locale = file.replace(/\.json$/, '');
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(readFileSync(join(localesDir, file), 'utf8'));
    } catch {
      // treat unreadable file as empty
    }
    const localeKeys = flattenKeys(parsed);
const missing: string[] = [];
    for (const k of extractedKeys) {
      if (!localeKeys.has(k)) missing.push(k);
    }
    missing.sort();
    results.push({ locale, missing });
  }
  return results;
}
