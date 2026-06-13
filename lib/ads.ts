/**
 * GAS Template, Ads Integration (AdMob)
 *
 * Config-gated ad wrapper. All functions are no-ops if:
 * - gasConfig.features.ads.enabled is false (default)
 * - Running on web
 * - react-native-google-mobile-ads is not installed
 *
 * To activate:
 * 1. Install: npx expo install react-native-google-mobile-ads
 * 2. Add to app.config.js: react-native-google-mobile-ads plugin with app IDs
 * 3. Set gasConfig.features.ads.enabled = true
 *
 * Dependencies (optional): react-native-google-mobile-ads
 */

import { isWeb } from './platform';
import { addBreadcrumb } from './sentry';
import { gasConfig } from '../gas.config';

const ADS_ENABLED = gasConfig.features.ads.enabled;

// Conditionally import ads SDK
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mobileAds: any = null;
if (!isWeb && ADS_ENABLED) {
  try {
    mobileAds = require('react-native-google-mobile-ads');
  } catch {
    // Module not installed, ads remain disabled
  }
}

/**
 * Initialize the Mobile Ads SDK.
 * No-op if ads are disabled, on web, or SDK not installed.
 */
export async function initAds(): Promise<void> {
  if (!mobileAds || !ADS_ENABLED) return;
  try {
    await mobileAds.default().initialize();
    addBreadcrumb('ads', 'AdMob initialized');
  } catch {
    // SDK init failed, degrade silently
  }
}

/**
 * Show an interstitial ad.
 * TODO: Implement with InterstitialAd.createForAdRequest(adUnitId)
 */
export async function showInterstitial(_adUnitId: string): Promise<boolean> {
  if (!mobileAds || !ADS_ENABLED) return false;
  // TODO: Load and show interstitial ad
  addBreadcrumb('ads', 'Interstitial requested (not yet implemented)');
  return false;
}

/**
 * Show a rewarded ad.
 * TODO: Implement with RewardedAd.createForAdRequest(adUnitId)
 */
export async function showRewarded(_adUnitId: string): Promise<boolean> {
  if (!mobileAds || !ADS_ENABLED) return false;
  // TODO: Load and show rewarded ad
  addBreadcrumb('ads', 'Rewarded ad requested (not yet implemented)');
  return false;
}
