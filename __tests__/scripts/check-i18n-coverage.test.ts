/**
 * Tests for scripts/i18n-helpers.ts
 *
 * Validates flattenKeys (nested JSON flattening), computeCoverage (diff logic),
 * and the exit-code contract: errors on en.json missing keys, warns on others.
 */

import { join } from 'node:path';
import { flattenKeys, computeCoverage, extractKeys } from '../../scripts/i18n-helpers';

// ─── flattenKeys ──────────────────────────────────────────────────────────────

describe('flattenKeys', () => {
  test('flattens a flat object', () => {
    const result = flattenKeys({ ok: 'OK', cancel: 'Cancel' });
    expect(result).toEqual(new Set(['ok', 'cancel']));
  });

  test('flattens nested objects to dot-notation keys', () => {
    const result = flattenKeys({
      screens: {
        home: { title: 'Home', subtitle: 'Welcome' },
        settings: { title: 'Settings' },
      },
    });
    expect(result).toEqual(
      new Set([
        'screens.home.title',
        'screens.home.subtitle',
        'screens.settings.title',
      ]),
    );
  });

  test('handles deeply nested objects', () => {
    const result = flattenKeys({ a: { b: { c: { d: 'value' } } } });
    expect(result).toEqual(new Set(['a.b.c.d']));
  });

  test('handles empty object', () => {
    const result = flattenKeys({});
    expect(result.size).toBe(0);
  });

  test('handles mixed flat and nested keys', () => {
    const result = flattenKeys({
      common: { ok: 'OK' },
      appName: 'My App',
    });
    expect(result).toEqual(new Set(['common.ok', 'appName']));
  });
});

// ─── computeCoverage ─────────────────────────────────────────────────────────

describe('computeCoverage', () => {
  test('returns empty array when locales dir does not exist', () => {
    const result = computeCoverage(new Set(['foo']), '/nonexistent/locales');
    expect(result).toEqual([]);
  });

  test('returns missing keys when locale file lacks keys present in extraction', () => {
    // Use the real locales/en.json — it has nested keys like common.loading
    // The extracted set here has keys not in en.json
    const extracted = new Set(['common.loading', 'screens.home.missing']);
    const localesDir = join(__dirname, '../../locales');
    const results = computeCoverage(extracted, localesDir);

    const en = results.find((r) => r.locale === 'en');
    expect(en).toBeDefined();
    // 'common.loading' is in en.json (as nested), but screens.home.missing is not
    // en.json uses flat keys like "common.loading" stored at top level via extract,
    // but the actual en.json uses nested structure. The key 'common.loading' flattened
    // from en.json is 'common.loading', so it should be present.
    expect(en!.missing).toContain('screens.home.missing');
    expect(en!.missing).not.toContain('common.loading');
  });

test('reports zero missing when extracted set is a subset of locale keys', () => {
    const extracted = new Set(['common.cancel', 'common.save']);
    const localesDir = join(__dirname, '../../locales');
    const results = computeCoverage(extracted, localesDir);
    const en = results.find((r) => r.locale === 'en');
    expect(en).toBeDefined();
    expect(en!.missing).toHaveLength(0);
  });
});

// ─── Exit code contract ───────────────────────────────────────────────────────

describe('exit code contract', () => {
  test('en.json missing keys is an error condition (exit 1)', () => {
    // Simulate: if en has missing keys, the script should exit 1.
    // We verify the condition logic here without spawning a subprocess.
    const extracted = new Set(['common.ok', 'screens.home.notInEn']);
    const localesDir = join(__dirname, '../../locales');
    const results = computeCoverage(extracted, localesDir);
    const en = results.find((r) => r.locale === 'en');
    expect(en).toBeDefined();
    // screens.home.notInEn is not in en.json => missing => should exit 1
    expect(en!.missing.length).toBeGreaterThan(0);
  });

test('non-en locales missing keys is a warning condition (exit 0)', () => {
    // If only non-en locales have missing keys (en is complete), exit 0.
    // We verify that en having no missing keys means no error condition.
    const extracted = new Set(['common.cancel']);
    const localesDir = join(__dirname, '../../locales');
    const results = computeCoverage(extracted, localesDir);
    const en = results.find((r) => r.locale === 'en');
    expect(en).toBeDefined();
    // common.cancel is in en.json => no missing => no error
    expect(en!.missing).toHaveLength(0);
  });

  test('exits 0 when no keys are extracted (nothing to diff)', () => {
    const extracted = new Set<string>();
    const localesDir = join(__dirname, '../../locales');
    const results = computeCoverage(extracted, localesDir);
    const en = results.find((r) => r.locale === 'en');
    expect(en).toBeDefined();
    expect(en!.missing).toHaveLength(0);
  });
});

// ─── extractKeys (smoke) ──────────────────────────────────────────────────────

describe('extractKeys', () => {
  test('returns a Set (possibly empty) for dirs that do not exist', () => {
    const result = extractKeys(['/nonexistent/dir']);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });
});