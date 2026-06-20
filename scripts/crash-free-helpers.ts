/**
 * Shared helpers for scripts/check-crash-free.mjs.
 *
 * Extracted into a .ts file so Jest (ts-jest) can import and unit-test them
 * without executing the top-level CLI logic in the .mjs file.
 */

import { readFileSync } from 'node:fs';

const SENTRY_API_BASE = 'https://sentry.io/api/0';
export const VALID_WINDOWS = ['24h', '7d'] as const;

// ─── gas.config.ts parsing ────────────────────────────────────────────────────

export interface CrashFreePerPlatform {
  ios: number;
  android: number;
}

export interface CrashFreeThresholds {
  production: number | CrashFreePerPlatform;
  staging: number | CrashFreePerPlatform;
  preview: number | CrashFreePerPlatform;
}

export interface CrashFreeConfig {
  thresholds: CrashFreeThresholds;
  window: string;
}

/**
 * Regex-parse crashFreeThresholds and crashFreeWindow from gas.config.ts.
 * File is not importable from plain Node — mirrors check-bundle-size.mjs pattern.
 */
export function readConfig(configPath = 'gas.config.ts'): CrashFreeConfig {
  let src: string;
  try {
    src = readFileSync(configPath, 'utf8');
  } catch {
    process.stderr.write('⚠️  Could not read gas.config.ts — using built-in defaults.\n');
    return { thresholds: { production: 99.0, staging: 95.0, preview: 0 }, window: '24h' };
  }

const thresholds: CrashFreeThresholds = { production: 99.0, staging: 95.0, preview: 0 };

  /**
   * Parse one env key from src. Handles both forms:
   *   scalar:      production: 99.0,
   *   per-platform: production: { ios: 99.5, android: 99.0 },
   */
  function parseEnv(env: string): number | CrashFreePerPlatform | undefined {
    // Try per-platform object form first
    const objRe = new RegExp(`${env}\\s*:\\s*\\{([^}]+)\\}`);
    const objMatch = src.match(objRe);
    if (objMatch) {
      const iosM = objMatch[1].match(/ios\s*:\s*(\d+(?:\.\d+)?)/);
      const andM = objMatch[1].match(/android\s*:\s*(\d+(?:\.\d+)?)/);
      if (iosM && andM) {
        const ios = parseFloat(iosM[1]);
        const android = parseFloat(andM[1]);
        if (!isNaN(ios) && !isNaN(android)) return { ios, android };
      }
    }
    // Fall back to scalar form
    const scalarRe = new RegExp(`${env}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*[,\\/\\n]`);
    const scalarMatch = src.match(scalarRe);
    if (scalarMatch) {
      const v = parseFloat(scalarMatch[1]);
      if (!isNaN(v)) return v;
    }
    return undefined;
  }

  const prod = parseEnv('production');
  if (prod !== undefined) thresholds.production = prod;
  const staging = parseEnv('staging');
  if (staging !== undefined) thresholds.staging = staging;
  const preview = parseEnv('preview');
  if (preview !== undefined) thresholds.preview = preview;

  let window = '24h';
  const windowMatch = src.match(/crashFreeWindow\s*:\s*['"](\d+[hd])['"]/);
  if (windowMatch && (VALID_WINDOWS as readonly string[]).includes(windowMatch[1])) {
    window = windowMatch[1];
  }

  return { thresholds, window };
}

// ─── Sentry fetch ─────────────────────────────────────────────────────────────

export interface FetchCrashFreeOptions {
  platform?: 'ios' | 'android';
}

/**
 * Fetch crash-free user rate from Sentry Sessions API.
 * Returns a number 0-100 (percentage), or null if the field is missing.
 * Throws on HTTP errors with a human-readable message.
 *
 * Pass `options.platform` to filter results to a specific platform
 * (appends `&query=platform:{platform}` to the Sentry sessions API URL).
 */
export async function fetchCrashFreeRate(
  org: string,
  project: string,
  token: string,
  statsPeriod: string,
  options?: FetchCrashFreeOptions,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<number | null> {
  // Sentry's sessions API accepts raw `platform:<name>` filter syntax — the colon
  // is part of the filter grammar and must NOT be percent-encoded (M5).
  const platformFilter = options?.platform ? `&query=platform:${encodeURIComponent(options.platform)}` : '';
  const url =
    `${SENTRY_API_BASE}/organizations/${encodeURIComponent(org)}/sessions/` +
    `?project=${encodeURIComponent(project)}` +
    `&statsPeriod=${encodeURIComponent(statsPeriod)}` +
    `&field=sum(session)` +
    `&field=crash_free_rate(user)` +
    platformFilter;

  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Sentry returned ${res.status}: invalid or missing SENTRY_AUTH_TOKEN. ` +
      `Verify the token has "org:read" and "project:read" scopes.`,
    );
  }

  if (res.status === 404) {
    throw new Error(
      `Sentry returned 404: org "${org}" or project "${project}" not found. ` +
      `Check SENTRY_ORG and SENTRY_PROJECT environment variables.`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sentry API error ${res.status}: ${body}`);
  }

  const data = await res.json() as { groups?: Array<{ totals?: Record<string, unknown> }> };

  const groups = data?.groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return null;
  }

  for (const group of groups) {
    const rate = group?.totals?.['crash_free_rate(user)'];
    if (rate !== undefined && rate !== null) {
      // Sentry returns value as 0.0-1.0 fraction; convert to percentage
      return typeof rate === 'number' ? rate * 100 : null;
    }
  }

  return null;
}

// ─── Per-platform check ───────────────────────────────────────────────────────

export interface PerPlatformResult {
  platform: 'ios' | 'android';
  rate: number | null;
  threshold: number;
  ok: boolean;
}

export interface PerPlatformCheckResult {
  ok: boolean;
  results: PerPlatformResult[];
}

/**
 * Fetch crash-free rates for iOS and Android in parallel and compare each
 * against its per-platform threshold. Returns an aggregate ok flag (true only
 * when BOTH platforms meet their threshold) plus per-platform detail.
 *
 * @param threshold  - Object with `ios` and `android` threshold values (0-100).
 * @param org        - Sentry organization slug.
 * @param project    - Sentry project slug.
 * @param token      - Sentry auth token.
 * @param statsPeriod - Time window, e.g. "24h" or "7d".
 * @param fetchImpl  - Optional fetch override (for testing).
 */
export async function checkPerPlatform(
  threshold: CrashFreePerPlatform,
  org: string,
  project: string,
  token: string,
  statsPeriod: string,
  fetchImpl?: typeof fetch,
): Promise<PerPlatformCheckResult> {
  const [iosRate, androidRate] = await Promise.all([
    fetchCrashFreeRate(org, project, token, statsPeriod, { platform: 'ios' }, fetchImpl),
    fetchCrashFreeRate(org, project, token, statsPeriod, { platform: 'android' }, fetchImpl),
  ]);

  const results: PerPlatformResult[] = [
    {
      platform: 'ios',
      rate: iosRate,
      threshold: threshold.ios,
      ok: iosRate !== null && iosRate >= threshold.ios,
    },
    {
      platform: 'android',
      rate: androidRate,
      threshold: threshold.android,
      ok: androidRate !== null && androidRate >= threshold.android,
    },
  ];

  return { ok: results.every(r => r.ok), results };
}
