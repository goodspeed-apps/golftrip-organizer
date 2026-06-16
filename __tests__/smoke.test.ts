/**
 * GAS Template — Smoke Tests
 *
 * Pure TypeScript tests for config validation and base patterns.
 * The DevAgent adds app-specific business logic tests below.
 *
 * Run: npm test
 */

import { gasConfig } from '../gas.config';

describe('GAS Config Validation', () => {
  test('app name is present and a sane length', () => {
    // app.name is the FULL app name, not the home-screen label. The iOS/Android label
    // is short by convention (~12 chars) and the OS truncates longer ones — it does not
    // reject them — so a 13-char name like "ShiftWake Pro" is valid and must not fail the
    // build. Enforce a sane upper bound instead (an absurdly long name is a codegen error).
    expect(gasConfig.app.name.length).toBeGreaterThan(0);
    expect(gasConfig.app.name.length).toBeLessThanOrEqual(30);
  });

  test('app slug is kebab-case', () => {
    expect(gasConfig.app.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test('app scheme is defined', () => {
    expect(gasConfig.app.scheme).toBeTruthy();
  });

  test('primary color is valid hex', () => {
    expect(gasConfig.design.colors.primary).toMatch(/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
  });

  test('all required colors are present', () => {
    const { colors } = gasConfig.design;
    const requiredColors = [
      'primary', 'primaryDark', 'secondary', 'accent',
      'background', 'backgroundDark', 'surface', 'surfaceDark',
      'text', 'textDark', 'textSecondary', 'textSecondaryDark',
      'border', 'borderDark', 'success', 'warning', 'error',
    ] as const;

    for (const key of requiredColors) {
      expect(colors[key]).toBeTruthy();
      expect(colors[key]).toMatch(/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/);
    }
  });

  test('at least one navigation tab is configured', () => {
    expect(gasConfig.navigation.tabs.length).toBeGreaterThan(0);
  });

  test('all tabs have required fields', () => {
    for (const tab of gasConfig.navigation.tabs) {
      expect(tab.id).toBeTruthy();
      expect(tab.label).toBeTruthy();
      expect(tab.icon).toBeTruthy();
      expect(tab.file).toBeTruthy();
    }
  });

  test('settings tab exists', () => {
    const hasSettings = gasConfig.navigation.tabs.some(
      (t) => t.file === 'settings',
    );
    expect(hasSettings).toBe(true);
  });
});

describe('Feature Flag Consistency', () => {
  test('paywall requires inAppPurchases enabled', () => {
    if (gasConfig.navigation.modals.includes('paywall')) {
      expect(gasConfig.features.inAppPurchases.enabled).toBe(true);
    }
  });

  test('IAP has at least 2 tiers when enabled', () => {
    if (gasConfig.features.inAppPurchases.enabled) {
      expect(gasConfig.features.inAppPurchases.tiers.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('gamification elements are specified when enabled', () => {
    if (gasConfig.features.gamification.enabled) {
      expect(gasConfig.features.gamification.elements.length).toBeGreaterThan(0);
    }
  });

  test('search entities are specified when enabled', () => {
    if (gasConfig.features.search.enabled) {
      expect(gasConfig.features.search.entities.length).toBeGreaterThan(0);
    }
  });

  test('i18n has locales when enabled', () => {
    if (gasConfig.features.i18n.enabled) {
      expect(gasConfig.features.i18n.locales.length).toBeGreaterThan(0);
      expect(gasConfig.features.i18n.locales).toContain(
        gasConfig.features.i18n.defaultLocale,
      );
    }
  });

  test('onboarding has steps when enabled', () => {
    if (gasConfig.features.onboarding.enabled) {
      expect(gasConfig.features.onboarding.steps.length).toBeGreaterThan(0);
    }
  });
});

describe('Score Thresholds (standard GAS pattern)', () => {
  // Standard 0-100 score thresholds used across all apps
  const GREEN_THRESHOLD = 70;
  const AMBER_THRESHOLD = 50;

  function getScoreColor(score: number): 'green' | 'amber' | 'grey' {
    if (score >= GREEN_THRESHOLD) return 'green';
    if (score >= AMBER_THRESHOLD) return 'amber';
    return 'grey';
  }

  test('score 100 is green', () => expect(getScoreColor(100)).toBe('green'));
  test('score 70 is green', () => expect(getScoreColor(70)).toBe('green'));
  test('score 69 is amber', () => expect(getScoreColor(69)).toBe('amber'));
  test('score 50 is amber', () => expect(getScoreColor(50)).toBe('amber'));
  test('score 49 is grey', () => expect(getScoreColor(49)).toBe('grey'));
  test('score 0 is grey', () => expect(getScoreColor(0)).toBe('grey'));
});

describe('Config Guard Rails', () => {
  test('biometric timeout is in valid range (1-60 minutes)', () => {
    const timeout = gasConfig.features.auth.biometric.timeoutMinutes;
    expect(timeout).toBeGreaterThanOrEqual(1);
    expect(timeout).toBeLessThanOrEqual(60);
  });

  test('app version follows semver format', () => {
    expect(gasConfig.app.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('feature flag booleans are actual booleans', () => {
    expect(typeof gasConfig.features.analytics.enabled).toBe('boolean');
    expect(typeof gasConfig.features.inAppPurchases.enabled).toBe('boolean');
    expect(typeof gasConfig.features.darkMode.enabled).toBe('boolean');
    expect(typeof gasConfig.features.helpSystem).toBe('boolean');
  });

  test('ads feature has required fields', () => {
    expect(gasConfig.features.ads).toBeDefined();
    expect(typeof gasConfig.features.ads.enabled).toBe('boolean');
    expect(gasConfig.features.ads.provider).toBe('admob');
  });

  test('auth providers require backend supabase config structure', () => {
    // If any OAuth provider is enabled, backend.supabase config keys must exist
    const auth = gasConfig.features.auth;
    const hasOAuth = auth.google || auth.apple || auth.twitter || auth.linkedin || auth.microsoft;
    if (hasOAuth) {
      expect(gasConfig.backend.supabase).toBeDefined();
      expect(typeof gasConfig.backend.supabase.url).toBe('string');
      expect(typeof gasConfig.backend.supabase.anonKey).toBe('string');
    }
  });
});

describe('Credential Guards', () => {
  // Template CI runs with EXPO_PUBLIC_SUPABASE_URL undefined (DevAgent sets it
  // per-app). In a generated app, the env var is always defined — empty or
  // populated — and these tests then guard against shipping OAuth without a
  // backend wired up.
  const isTemplateContext = process.env.EXPO_PUBLIC_SUPABASE_URL === undefined;

  test('Supabase URL is non-empty when OAuth is enabled', () => {
    if (isTemplateContext) return;
    const auth = gasConfig.features.auth;
    const hasOAuth = auth.google || auth.apple || auth.twitter || auth.linkedin || auth.microsoft;
    if (hasOAuth) {
      expect(gasConfig.backend.supabase.url).not.toBe('');
    }
  });

  test('Supabase anon key is non-empty when OAuth is enabled', () => {
    if (isTemplateContext) return;
    const auth = gasConfig.features.auth;
    const hasOAuth = auth.google || auth.apple || auth.twitter || auth.linkedin || auth.microsoft;
if (hasOAuth) {
      expect(gasConfig.backend.supabase.anonKey).not.toBe('');
    }
  });

  test('paid tiers have non-empty productIds', () => {
    if (!gasConfig.features.inAppPurchases.enabled) return;
    for (const tier of gasConfig.features.inAppPurchases.tiers) {
      if (tier.name.toLowerCase() !== 'free') {
        expect(tier.productId).toBeTruthy();
      }
    }
  });
});

describe('Compliance Config Sync', () => {
  // If the operator has set the matching Supabase Function secrets, they MUST
  // agree with gas.config.compliance. If env is unset, the edge function will
  // fall back to gas.config defaults (which match by construction) — no drift.
  test('account-deletion env mirrors gas.config when both are set', () => {
    const envGrace = process.env.ACCOUNT_DELETION_GRACE_DAYS;
    if (envGrace !== undefined) {
      expect(Number(envGrace)).toBe(gasConfig.compliance.accountDeletionGracePeriod.days);
    }
    const envImmediate = process.env.ALLOW_IMMEDIATE_DELETION;
    if (envImmediate !== undefined) {
      expect(envImmediate !== 'false').toBe(gasConfig.compliance.allowImmediateDeletion);
    }
  });
});

describe('Payment Model Config Validation', () => {
  test('one-time purchases have valid structure when defined', () => {
    const products = gasConfig.features.inAppPurchases.oneTimePurchases;
    if (!products) return;
    for (const p of products) {
      expect(p.id).toBeTruthy();
      expect(p.productId).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(['lifetime', 'feature_pack', 'content']).toContain(p.type);
    }
  });

  test('credit packs have valid structure when enabled', () => {
    const credits = gasConfig.features.inAppPurchases.credits;
    if (!credits?.enabled) return;
    expect(credits.currencyName).toBeTruthy();
    expect(credits.currencyNamePlural).toBeTruthy();
    expect(credits.packs.length).toBeGreaterThan(0);
    for (const pack of credits.packs) {
      expect(pack.id).toBeTruthy();
      expect(pack.productId).toBeTruthy();
      expect(pack.credits).toBeGreaterThan(0);
    }
  });

  test('marketplace has valid fee when enabled', () => {
    const mp = gasConfig.features.inAppPurchases.marketplace;
    if (!mp?.enabled) return;
    expect(mp.platformFeePercent).toBeGreaterThan(0);
    expect(mp.platformFeePercent).toBeLessThanOrEqual(50);
    expect(mp.listingCategories.length).toBeGreaterThan(0);
    expect(mp.sellerPayoutMethod).toBe('stripe_connect');
  });

  test('stripe key is configured when marketplace is enabled', () => {
    const mp = gasConfig.features.inAppPurchases.marketplace;
    if (!mp?.enabled) return;
    expect(gasConfig.backend.stripe).toBeDefined();
    expect(gasConfig.backend.stripe?.publishableKey).toBeTruthy();
  });
});

// ─── DevAgent: Add app-specific smoke tests below this line ───────────────────
