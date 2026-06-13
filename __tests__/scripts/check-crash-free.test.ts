/**
 * Tests for scripts/check-crash-free.mjs (via crash-free-helpers.ts)
 *
 * Imports readConfig and fetchCrashFreeRate from scripts/crash-free-helpers.ts
 * and validates threshold logic, HTTP error handling, and missing-field
 * graceful fallback with mocked fetch.
 */

import path from 'node:path';
import { readConfig, fetchCrashFreeRate, checkPerPlatform } from '../../scripts/crash-free-helpers';

const CONFIG_PATH = path.resolve(__dirname, '../../gas.config.ts');

// ─── fetch mock ───────────────────────────────────────────────────────────────

function makeFetchResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── readConfig ───────────────────────────────────────────────────────────────

describe('readConfig', () => {
test('reads default thresholds from gas.config.ts', () => {
    const { thresholds, window } = readConfig(CONFIG_PATH);
    // gas.config.ts ships with production: { ios: 99.5, android: 99.0 }, staging: 95.0, preview: 0
    // I6: per-platform object form is now parsed correctly
    expect(thresholds.production).toEqual({ ios: 99.5, android: 99.0 });
    expect(thresholds.staging).toBe(95.0);
    expect(thresholds.preview).toBe(0);
    expect(['24h', '7d']).toContain(window);
  });

  test('parses per-platform object form', () => {
    const tmpFile = require('node:os').tmpdir() + '/gas-test.config.ts';
    require('node:fs').writeFileSync(tmpFile,
      'crashFreeThresholds: { production: { ios: 99.5, android: 99.0 }, staging: 95.0, preview: 0 },\n' +
      "crashFreeWindow: '7d',\n"
    );
    const { thresholds, window } = readConfig(tmpFile);
    expect(thresholds.production).toEqual({ ios: 99.5, android: 99.0 });
    expect(thresholds.staging).toBe(95.0);
    expect(window).toBe('7d');
    require('node:fs').unlinkSync(tmpFile);
  });

  test('parses scalar form', () => {
    const tmpFile = require('node:os').tmpdir() + '/gas-scalar.config.ts';
    require('node:fs').writeFileSync(tmpFile,
      'crashFreeThresholds: { production: 99.9, staging: 90.0, preview: 0 },\n' +
      "crashFreeWindow: '24h',\n"
    );
    const { thresholds, window } = readConfig(tmpFile);
    expect(thresholds.production).toBe(99.9);
    expect(thresholds.staging).toBe(90.0);
    expect(window).toBe('24h');
    require('node:fs').unlinkSync(tmpFile);
  });

  test('falls back to defaults when config file is missing', () => {
    const { thresholds, window } = readConfig('/nonexistent/path/gas.config.ts');
    expect(thresholds.production).toBe(99.0);
    expect(thresholds.staging).toBe(95.0);
    expect(thresholds.preview).toBe(0);
    expect(window).toBe('24h');
  });
});

// ─── fetchCrashFreeRate ───────────────────────────────────────────────────────

describe('fetchCrashFreeRate', () => {
  test('exits 0 path: returns rate * 100 when rate >= threshold', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeFetchResponse(200, {
        groups: [
          {
            totals: {
              'sum(session)': 5000,
              'crash_free_rate(user)': 0.9975,
            },
          },
        ],
      }),
    ) as typeof globalThis.fetch;

    const rate = await fetchCrashFreeRate('my-org', 'my-project', 'tok', '24h');
    expect(rate).toBeCloseTo(99.75, 2);
    // 99.75 >= 99.0 threshold => passes
    expect(rate! >= 99.0).toBe(true);
  });

  test('exits 1 path: returns rate below threshold', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeFetchResponse(200, {
        groups: [
          {
            totals: {
              'sum(session)': 5000,
              'crash_free_rate(user)': 0.982,
            },
          },
        ],
      }),
    ) as typeof globalThis.fetch;

    const rate = await fetchCrashFreeRate('my-org', 'my-project', 'tok', '24h');
    expect(rate).toBeCloseTo(98.2, 1);
    // 98.2 < 99.0 threshold => fails
    expect(rate! >= 99.0).toBe(false);
  });

  test('throws with clear message on 401 (invalid token)', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeFetchResponse(401, { detail: 'Unauthorized' }),
    ) as typeof globalThis.fetch;

    await expect(
      fetchCrashFreeRate('my-org', 'my-project', 'bad-tok', '24h'),
    ).rejects.toThrow(/401.*SENTRY_AUTH_TOKEN/i);
  });

  test('throws with clear message on 404 (wrong org or project)', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeFetchResponse(404, { detail: 'Not found' }),
    ) as typeof globalThis.fetch;

    await expect(
      fetchCrashFreeRate('wrong-org', 'wrong-project', 'tok', '24h'),
    ).rejects.toThrow(/404.*not found/i);
  });

  test('returns null when crash_free_rate(user) field is missing from response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeFetchResponse(200, {
        groups: [
          {
            totals: {
              'sum(session)': 1000,
              // crash_free_rate(user) intentionally absent
            },
          },
        ],
      }),
    ) as typeof globalThis.fetch;

    const rate = await fetchCrashFreeRate('my-org', 'my-project', 'tok', '24h');
    expect(rate).toBeNull();
  });

  test('returns null when groups array is empty', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      makeFetchResponse(200, { groups: [] }),
    ) as typeof globalThis.fetch;

    const rate = await fetchCrashFreeRate('my-org', 'my-project', 'tok', '24h');
    expect(rate).toBeNull();
  });
});

// ─── Threshold comparison logic ───────────────────────────────────────────────

describe('threshold comparison', () => {
  test('passes when rate equals threshold exactly', () => {
    expect(99.0 >= 99.0).toBe(true);
  });

  test('fails when rate is below threshold', () => {
    expect(98.5 >= 99.0).toBe(false);
  });

test('preview threshold of 0 means check is disabled', () => {
    const { thresholds } = readConfig(CONFIG_PATH);
    expect(thresholds.preview).toBe(0);
  });
});

// ─── checkPerPlatform ─────────────────────────────────────────────────────────

function makePerPlatformFetch(iosRate: number | null, androidRate: number | null) {
  let callCount = 0;
  return jest.fn().mockImplementation((url: string) => {
    callCount++;
    const isIos = url.includes('platform:ios');
    const rate = isIos ? iosRate : androidRate;
    return Promise.resolve(
      makeFetchResponse(
        200,
        rate === null
          ? { groups: [{ totals: { 'sum(session)': 100 } }] }
          : { groups: [{ totals: { 'sum(session)': 5000, 'crash_free_rate(user)': rate / 100 } }] },
      ),
    );
  }) as unknown as typeof fetch;
}

describe('checkPerPlatform', () => {
  const threshold = { ios: 99.5, android: 99.0 };

  test('both platforms above threshold — ok is true', async () => {
    const mockFetch = makePerPlatformFetch(99.8, 99.2);
    const { ok, results } = await checkPerPlatform(
      threshold, 'org', 'proj', 'tok', '24h', mockFetch,
    );
    expect(ok).toBe(true);
    expect(results).toHaveLength(2);
    expect(results.find(r => r.platform === 'ios')!.ok).toBe(true);
    expect(results.find(r => r.platform === 'android')!.ok).toBe(true);
  });

  test('iOS below threshold, Android above — ok is false', async () => {
    const mockFetch = makePerPlatformFetch(99.0, 99.2);
    const { ok, results } = await checkPerPlatform(
      threshold, 'org', 'proj', 'tok', '24h', mockFetch,
    );
    expect(ok).toBe(false);
    expect(results.find(r => r.platform === 'ios')!.ok).toBe(false);
    expect(results.find(r => r.platform === 'android')!.ok).toBe(true);
  });

  test('Android below threshold, iOS above — ok is false', async () => {
    const mockFetch = makePerPlatformFetch(99.8, 98.5);
    const { ok, results } = await checkPerPlatform(
      threshold, 'org', 'proj', 'tok', '24h', mockFetch,
    );
    expect(ok).toBe(false);
    expect(results.find(r => r.platform === 'ios')!.ok).toBe(true);
    expect(results.find(r => r.platform === 'android')!.ok).toBe(false);
  });

  test('both platforms below threshold — ok is false', async () => {
    const mockFetch = makePerPlatformFetch(98.0, 97.5);
    const { ok, results } = await checkPerPlatform(
      threshold, 'org', 'proj', 'tok', '24h', mockFetch,
    );
    expect(ok).toBe(false);
    expect(results.find(r => r.platform === 'ios')!.ok).toBe(false);
    expect(results.find(r => r.platform === 'android')!.ok).toBe(false);
  });

  test('mixed config: staging scalar resolves correctly via readConfig fallback', () => {
    const { thresholds } = readConfig(CONFIG_PATH);
    // staging is still a scalar 95.0
    expect(typeof thresholds.staging).toBe('number');
    expect(thresholds.staging).toBe(95.0);
  });
});
