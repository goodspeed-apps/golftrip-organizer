/**
 * Tests for lib/revenuecat.ts
 */

const mockPurchases = {
  configure: jest.fn(),
  setLogLevel: jest.fn(),
  logIn: jest.fn(async () => ({})),
  logOut: jest.fn(async () => ({})),
  getOfferings: jest.fn(async () => ({
    current: {
      availablePackages: [{ identifier: '$rc_monthly', product: {} }],
    },
  })),
  purchasePackage: jest.fn(async () => ({ customerInfo: {} })),
  restorePurchases: jest.fn(async () => ({})),
};
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../../lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('../../lib/sentry', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }));

(global as any).__DEV__ = true;

import { initRevenueCat, identifyRevenueCatUser, resetRevenueCatUser, getOfferings, purchasePackage, restorePurchases, _resetOfferingsCache } from '../../lib/revenuecat';
import { captureException } from '../../lib/sentry';

beforeEach(() => jest.clearAllMocks());

describe('initRevenueCat', () => {
  test('no-op when feature disabled', async () => {
    // gasConfig has inAppPurchases.enabled = true but keys are empty
    // So initRevenueCat returns early due to missing apiKey
    await initRevenueCat();
    expect(mockPurchases.configure).not.toHaveBeenCalled();
  });
});

describe('identifyRevenueCatUser', () => {
  test('calls logIn and captures exception on error', async () => {
    mockPurchases.logIn.mockRejectedValueOnce(new Error('fail'));
    await identifyRevenueCatUser('user-1');
    expect(captureException).toHaveBeenCalled();
  });

  test('calls logIn successfully', async () => {
    await identifyRevenueCatUser('user-1');
    expect(mockPurchases.logIn).toHaveBeenCalledWith('user-1');
  });
});

describe('resetRevenueCatUser', () => {
  test('calls logOut and captures exception on error', async () => {
    mockPurchases.logOut.mockRejectedValueOnce(new Error('fail'));
    await resetRevenueCatUser();
    expect(captureException).toHaveBeenCalled();
  });
});

describe('getOfferings', () => {
  test('returns offerings on success', async () => {
    const result = await getOfferings();
    expect(result).not.toBeNull();
  });

test('returns null on error', async () => {
    _resetOfferingsCache();
    mockPurchases.getOfferings.mockRejectedValueOnce(new Error('network'));
    const result = await getOfferings();
    expect(result).toBeNull();
    expect(captureException).toHaveBeenCalled();
  });
});

describe('purchasePackage', () => {
  test('throws when package not found', async () => {
    await expect(purchasePackage('$rc_unknown')).rejects.toThrow('Package not found');
  });
});

describe('restorePurchases', () => {
  test('calls restorePurchases', async () => {
    await restorePurchases();
    expect(mockPurchases.restorePurchases).toHaveBeenCalled();
  });
});
