#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

// Tightened: requires matching closing quote+paren without an "as any" cast
// between, so `t('foo' as any)` doesn't become a spurious i18n key.
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
      // Skip symlinks whose target is already inside the traversal tree to
      // prevent loops; allow new-target symlinks via the visited check above.
      try {
        const target = realpathSync(full);
        if (visited.has(target)) continue;
      } catch { continue; }
    }
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(full, files, visited, depth + 1);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

const allKeys = new Set();
for (const dir of SEARCH_DIRS) {
  try {
    for (const f of walk(dir)) {
      const src = readFileSync(f, 'utf8');
      let m;
      while ((m = KEY_REGEX.exec(src)) !== null) allKeys.add(m[1]);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

let existing = {};
try { existing = JSON.parse(readFileSync('locales/en.json', 'utf8')); } catch {}

const merged = { ...existing };
let added = 0;
for (const key of allKeys) {
  if (!(key in merged)) { merged[key] = key; added++; }
}

writeFileSync('locales/en.json', JSON.stringify(merged, null, 2) + '\n');
console.log(`✓ Extracted ${allKeys.size} keys; ${added} new added to locales/en.json`);
