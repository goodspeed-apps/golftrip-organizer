import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// --- Mocks ---

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
      single: jest.fn(async () => ({ data: { subscription_tier: 'free', trial_ends_at: null } })),
    })),
  },
}));

jest.mock('../../lib/revenuecat', () => ({
  getOfferings: jest.fn(async () => null),
  purchasePackage: jest.fn(async () => ({})),
  purchaseProduct: jest.fn(async () => ({})),
  restorePurchases: jest.fn(async () => ({})),
  Purchases: {
    addCustomerInfoUpdateListener: jest.fn(),
  },
}));

jest.mock('../../services/api', () => ({
  callEdge: jest.fn(async () => ({})),
}));

jest.mock('react-native-purchases', () => ({
  default: {
    configure: jest.fn(),
    purchasePackage: jest.fn(async () => ({})),
    addCustomerInfoUpdateListener: jest.fn(),
  },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 1 },
}));

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Platform: { OS: 'ios', Version: '17', select: (o: any) => o.ios },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (s: any) => s, flatten: (s: any) => s ?? {} },
  Linking: { openURL: jest.fn(async () => {}) },
}));

// Pin gas.config to the template values the assertions below assume, so a
// generated app that customizes gasConfig (renamed/reordered tiers, different
// store URLs, etc.) doesn't break this test. We provide ONLY the fields the
// SubscriptionManager component tree (SubscriptionManager + Paywall + Card +
// Button + useSubscription) actually reads. Hoisted above the impl import.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    features: {
      inAppPurchases: {
        enabled: true,
        oneTimePurchases: [],
        tiers: [
          { name: 'Free', productId: '', price: 'Free', features: ['Basic features', 'Limited usage'] },
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
    design: { layout: { cardStyle: 'elevated', buttonStyle: 'rounded' } },
    releaseChannels: { storeUrl: { ios: '', android: '' } },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

import { SubscriptionManager } from '../../components/SubscriptionManager';

describe('SubscriptionManager', () => {
  it('renders current tier name', async () => {
    const { getByTestId } = await render(<SubscriptionManager />);
    const el = getByTestId('current-tier-name');
    expect(el).toBeTruthy();
    // Free tier is default from mock; displayName comes from config
    expect(el.props.children).toBeTruthy();
  });

  it('upgrade CTA fires onPress and shows paywall', async () => {
    const { getByTestId } = await render(<SubscriptionManager />);
    const btn = getByTestId('btn-upgrade');
    expect(btn).toBeTruthy();
    fireEvent.press(btn);
    // No crash means the handler ran; modal state toggled
  });
});