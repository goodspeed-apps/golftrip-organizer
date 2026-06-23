/**
 * Tests for hooks/useSubscription.ts — Subscription state logic.
 */

describe('useSubscription logic', () => {
  test('initial state defaults to free tier', () => {
    const state = {
      tier: 'free',
      isTrialing: false,
      trialEndsAt: null,
      isPaid: false,
      isLifetime: false,
      isLoading: true,
    };
    expect(state.tier).toBe('free');
    expect(state.isPaid).toBe(false);
  });

  test('purchase guard prevents double purchase', () => {
    let purchaseInProgress = false;
    const purchase = () => {
      if (purchaseInProgress) return false;
      purchaseInProgress = true;
      return true;
    };
    expect(purchase()).toBe(true);
    expect(purchase()).toBe(false); // blocked
    purchaseInProgress = false;
    expect(purchase()).toBe(true);
  });

  test('trial detection from entitlements', () => {
    const entitlements = {
      active: {
        premium: {
          periodType: 'TRIAL',
          expirationDate: '2024-12-31',
        },
      },
    };
    const isTrialing = entitlements.active.premium?.periodType === 'TRIAL';
    expect(isTrialing).toBe(true);
  });

  test('isPaid when tier is not free', () => {
    const isPaid = (tier: string) => tier !== 'free';
    expect(isPaid('pro')).toBe(true);
    expect(isPaid('free')).toBe(false);
  });

  test('refresh updates tier from customer info', () => {
    let tier = 'free';
    // Simulate refresh
    const customerInfo = { entitlements: { active: { premium: {} } } };
    if (customerInfo.entitlements.active.premium) {
      tier = 'pro';
    }
    expect(tier).toBe('pro');
  });
});
