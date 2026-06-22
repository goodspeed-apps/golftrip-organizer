import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('../../context/ThemeContext', () => ({
  useThemeColors: () => ({
    colors: {
      background: '#fff',
      surface: '#f5f5f5',
      text: '#000',
      textSecondary: '#666',
      primary: '#6366F1',
      border: '#ccc',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
    resolved: 'light',
  }),
}));

jest.mock('../../lib/sentry', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('../../lib/posthog', () => ({
  captureEvent: jest.fn(),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'u1' } } })) },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({
        data: { subscription_tier: 'free', trial_ends_at: null },
      })),
    })),
  },
}));

jest.mock('../../lib/revenuecat', () => ({
  getOfferings: jest.fn(async () => null),
  purchasePackage: jest.fn(async () => ({})),
  purchaseProduct: jest.fn(async () => ({})),
  restorePurchases: jest.fn(async () => ({})),
  Purchases: { addCustomerInfoUpdateListener: jest.fn() },
}));

jest.mock('../../services/api', () => ({
  callEdge: jest.fn(async () => ({})),
}));

jest.mock('react-native-purchases', () => ({
  default: {
    configure: jest.fn(),
    purchasePackage: jest.fn(async () => ({})),
    restorePurchases: jest.fn(async () => ({})),
    getOfferings: jest.fn(async () => ({ current: null })),
    addCustomerInfoUpdateListener: jest.fn(),
  },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 1 },
}));

// Mock gas.config to the TEMPLATE values this test asserts against, so the test
// stays green when a generated app customizes gasConfig (renamed/added tiers,
// different prices, disabled IAP, different card/button style). Provides only
// the fields the Paywall + useSubscription + Card + Button actually read.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    design: {
      layout: { cardStyle: 'elevated', buttonStyle: 'rounded' },
    },
    features: {
      inAppPurchases: {
        enabled: true,
        oneTimePurchases: [],
        tiers: [
          {
            name: 'Free',
            productId: '',
            price: 'Free',
            features: ['Basic features', 'Limited usage'],
          },
          {
            name: 'Pro',
            productId: 'pro_monthly',
            price: '$4.99/mo',
            features: ['Unlimited access', 'Premium features', 'Priority support'],
            trialDays: 7,
          },
        ],
      },
    },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

import { gasConfig } from '../../gas.config';
import { Paywall } from '../../components/Paywall';

const RN = require('react-native');
const TIERS = gasConfig.features.inAppPurchases.tiers;

async function renderPaywall(ui: React.ReactElement) {
  const result = await render(ui);
  await act(async () => {});
  return result;
}

describe('Paywall', () => {
  beforeEach(() => { RN.Platform.OS = 'ios'; });
  afterEach(() => { RN.Platform.OS = 'ios'; });

  it('renders one card per tier in gas.config', async () => {
    const { getByTestId } = await renderPaywall(<Paywall />);
    for (const t of TIERS) {
      const tierKey = t.name.toLowerCase();
      expect(getByTestId(`tier-name-${tierKey}`)).toBeTruthy();
    }
  });

  it('shows "Current plan" badge when useSubscription returns free tier', async () => {
    const { getByTestId } = await renderPaywall(<Paywall />);
    const freeTierKey = TIERS[0].name.toLowerCase();
    expect(getByTestId(`badge-current-${freeTierKey}`)).toBeTruthy();
  });

  it('shows web-disabled button on web for paid tiers', async () => {
    RN.Platform.OS = 'web';
    const { getByTestId } = await renderPaywall(<Paywall />);
    // Find the web-disabled button for the first paid (non-free) tier
    // Free is TIERS[0] (see freeTierKey above); the paid tier is the first after it. Select
    // by index, not `productId !== ''`: a generated config can give every tier a non-empty
    // productId (e.g. the free tier gets its own id), making `!== ''` a no-overlap comparison
    // that fails ts-jest compilation (TS2367) and takes the whole components suite down.
    const paidTier = TIERS.find((_tier, i) => i > 0);
    if (paidTier) {
      expect(getByTestId(`btn-web-disabled-${paidTier.name.toLowerCase()}`)).toBeTruthy();
    }
  });
});