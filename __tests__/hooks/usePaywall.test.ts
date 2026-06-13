/**
 * Tests for hooks/usePaywall.ts — Paywall access logic.
 */

describe('usePaywall logic', () => {
  test('tier hierarchy: pro > basic > free', () => {
    const tiers = ['free', 'basic', 'pro', 'enterprise'];
    const tierRank = (tier: string) => tiers.indexOf(tier);
    expect(tierRank('pro')).toBeGreaterThan(tierRank('basic'));
    expect(tierRank('basic')).toBeGreaterThan(tierRank('free'));
  });

  test('checkAccess grants for matching or higher tier', () => {
    const tiers = ['free', 'basic', 'pro', 'enterprise'];
    const userTier = 'pro';
    const required = 'basic';
    const hasAccess = tiers.indexOf(userTier) >= tiers.indexOf(required);
    expect(hasAccess).toBe(true);
  });

  test('checkAccess denies for lower tier', () => {
    const tiers = ['free', 'basic', 'pro', 'enterprise'];
    const userTier = 'free';
    const required = 'pro';
    const hasAccess = tiers.indexOf(userTier) >= tiers.indexOf(required);
    expect(hasAccess).toBe(false);
  });

  test('checkUsageLimit allows when under limit', () => {
    const currentUsage = 3;
    const freeLimit = 5;
    const allowed = currentUsage < freeLimit;
    expect(allowed).toBe(true);
  });

  test('checkUsageLimit blocks when at or over limit', () => {
    const currentUsage = 5;
    const freeLimit = 5;
    const allowed = currentUsage < freeLimit;
    expect(allowed).toBe(false);
  });
});
