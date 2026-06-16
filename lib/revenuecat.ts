/**
 * GAS Template, RevenueCat In-App Purchases
 *
 * Platform-aware RevenueCat initialization with identify/reset, offerings,
 * package purchase, and restore. All operations are conditional on
 * gasConfig.features.inAppPurchases.enabled, if disabled, init is a no-op.
 *
 * Web: All functions are no-ops since in-app purchases are not supported on web.
 *
 * Config: reads iOS/Android API keys from gasConfig.backend.revenuecat.
 *
 * Dependencies: react-native-purchases
 */

import { Platform } from 'react-native';
import { isWeb } from './platform';
import { captureEvent } from './posthog';
import { captureException, addBreadcrumb } from './sentry';
import { gasConfig } from '../gas.config';

// Conditionally import react-native-purchases only on native
let Purchases: typeof import('react-native-purchases').default | null = null;
let LOG_LEVEL: typeof import('react-native-purchases').LOG_LEVEL | null = null;
if (!isWeb) {
  try {
    const rnp = require('react-native-purchases');
    Purchases = rnp.default;
    LOG_LEVEL = rnp.LOG_LEVEL;
  } catch {
    // Module not available
  }
}

const REVENUECAT_APPLE_KEY = gasConfig.backend.revenuecat.iosKey;
const REVENUECAT_GOOGLE_KEY = gasConfig.backend.revenuecat.androidKey;

// Module-level offerings cache to avoid redundant network calls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedOfferings: any = null;
let offeringsCachedAt = 0;
const OFFERINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize RevenueCat SDK.
 * No-op if inAppPurchases feature is disabled, the platform key is missing, or on web.
 * Enables debug logging in __DEV__ mode.
 */
export async function initRevenueCat(): Promise<void> {
  if (isWeb || !Purchases) return;
  if (!gasConfig.features.inAppPurchases.enabled) return;

  const apiKey =
    Platform.OS === 'ios' ? REVENUECAT_APPLE_KEY : REVENUECAT_GOOGLE_KEY;
  if (!apiKey) return;

  if (__DEV__ && LOG_LEVEL) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  try {
    await Purchases.configure({ apiKey });
    captureEvent('revenuecat_initialized', { platform: Platform.OS });
    addBreadcrumb('iap', 'RevenueCat initialized');
  } catch (e) {
    captureException(e, { component: 'revenuecat', action: 'init' });
    throw e;
  }
}

/**
 * Associate the current authenticated user with RevenueCat.
 * Call after login / signup alongside identifyPostHogUser.
 */
export async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (isWeb || !Purchases) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    captureException(e, { component: 'revenuecat', action: 'identify', userId });
    if (__DEV__) console.warn('[RevenueCat] identify error', e);
  }
}

/**
 * Clear user identity on logout.
 */
export async function resetRevenueCatUser(): Promise<void> {
  if (isWeb || !Purchases) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    captureException(e, { component: 'revenuecat', action: 'reset' });
    if (__DEV__) console.warn('[RevenueCat] reset error', e);
  }
}

/**
 * Fetch current offerings (subscription tiers, products) from RevenueCat.
 * Returns null on error or on web so callers can degrade gracefully.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOfferings(): Promise<any> {
  if (isWeb || !Purchases) return null;
  if (cachedOfferings && Date.now() - offeringsCachedAt < OFFERINGS_CACHE_TTL_MS) {
    return cachedOfferings;
  }
  try {
    const offerings = await Purchases.getOfferings();
    cachedOfferings = offerings;
    offeringsCachedAt = Date.now();
    return offerings;
  } catch (e) {
    captureException(e, { component: 'revenuecat', action: 'getOfferings' });
    if (__DEV__) console.warn('[RevenueCat] getOfferings error', e);
    return cachedOfferings; // return stale cache if available, else null
  }
}

/**
 * Purchase a specific package by its identifier (e.g., "$rc_monthly").
 * Throws on failure so the caller can show an appropriate error UI.
 * Returns null on web.
 */
export async function purchasePackage(packageIdentifier: string): Promise<unknown> {
  if (isWeb || !Purchases) return null;
  try {
    const offerings = await getOfferings();
    const current = (offerings as { current?: { availablePackages: Array<{ identifier: string }> } })?.current;
    if (!current) throw new Error('No offerings available');

    const pkg = current.availablePackages.find(
      (p: { identifier: string }) => p.identifier === packageIdentifier
    );
    if (!pkg) throw new Error('Package not found: ' + packageIdentifier);

    return await Purchases.purchasePackage(pkg as never);
  } catch (e) {
    if (__DEV__) console.warn('[RevenueCat] purchasePackage error', e);
    throw e;
  }
}

/**
 * Restore previous purchases (e.g., after reinstall or device switch).
 * Throws on failure so the caller can show an error UI.
 * Returns null on web.
 */
export async function restorePurchases(): Promise<unknown> {
  if (isWeb || !Purchases) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    if (__DEV__) console.warn('[RevenueCat] restorePurchases error', e);
    throw e;
  }
}

/**
 * Purchase a one-time or consumable product by its store product ID.
 * Use for consumables (e.g., coins, credits) that don't appear in offerings.
 * Returns null on web.
 */
export async function purchaseProduct(productId: string): Promise<unknown> {
  if (isWeb || !Purchases) return null;
  try {
    const products = await Purchases.getProducts([productId]);
    if (!products.length) throw new Error('Product not found: ' + productId);
    return await Purchases.purchaseStoreProduct(products[0]);
  } catch (e) {
    if (__DEV__) console.warn('[RevenueCat] purchaseProduct error', e);
    throw e;
  }
}

/**
 * Get the current customer's entitlement info from RevenueCat.
 * Useful for checking active entitlements, subscription status, etc.
 * Returns null on web.
 */
export async function getCustomerInfo(): Promise<unknown> {
  if (isWeb || !Purchases) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    captureException(e, { component: 'revenuecat', action: 'getCustomerInfo' });
    if (__DEV__) console.warn('[RevenueCat] getCustomerInfo error', e);
    return null;
  }
}

export { Purchases };

/** @internal, test-only: resets the module-level offerings cache. */
export function _resetOfferingsCache(): void {
  cachedOfferings = null;
  offeringsCachedAt = 0;
}
