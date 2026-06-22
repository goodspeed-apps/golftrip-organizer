// Native stub for the OPTIONAL dep `react-native-google-mobile-ads`.
//
// It is intentionally NOT declared: the real package needs an AdMob app-id
// config plugin or it crashes at native init, so adding it blindly ships a
// crashing app. Generated apps over-import ads code, so this stub renders
// nothing and no-ops the ad APIs — the bundle builds and the app simply runs
// ad-free. metro.config.js routes here ONLY when the real package isn't
// installed (a deliberate AdMob integration uses the real module + config).
//
// React components must return null (they appear in JSX); hooks/enums/classes
// return safe inert values so call sites don't throw at runtime.
const Noop = () => null;
const makeAd = () => ({
  load: () => {},
  show: () => {},
  addAdEventListener: () => () => {},
  removeAllListeners: () => {},
  loaded: false,
});

function mobileAds() {
  return {
    initialize: () => Promise.resolve([]),
    setRequestConfiguration: () => Promise.resolve(),
    openAdInspector: () => Promise.resolve(),
    openDebugMenu: () => {},
  };
}
mobileAds.default = mobileAds;

module.exports = mobileAds;
module.exports.default = mobileAds;

// Components
module.exports.BannerAd = Noop;
module.exports.GAMBannerAd = Noop;

// Enums / constants
module.exports.BannerAdSize = {
  BANNER: 'BANNER',
  LARGE_BANNER: 'LARGE_BANNER',
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
  FULL_BANNER: 'FULL_BANNER',
  LEADERBOARD: 'LEADERBOARD',
  ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
  ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
  WIDE_SKYSCRAPER: 'WIDE_SKYSCRAPER',
};
module.exports.TestIds = {
  BANNER: 'test-banner',
  INTERSTITIAL: 'test-interstitial',
  REWARDED: 'test-rewarded',
  REWARDED_INTERSTITIAL: 'test-rewarded-interstitial',
  APP_OPEN: 'test-app-open',
  GAM_BANNER: 'test-gam-banner',
  GAM_INTERSTITIAL: 'test-gam-interstitial',
  GAM_REWARDED: 'test-gam-rewarded',
};
module.exports.AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  CLOSED: 'closed',
  CLICKED: 'clicked',
  PAID: 'paid',
};
module.exports.RewardedAdEventType = {
  LOADED: 'rewarded_loaded',
  EARNED_REWARD: 'rewarded_earned_reward',
};
module.exports.MaxAdContentRating = { G: 'G', PG: 'PG', T: 'T', MA: 'MA' };
module.exports.AdsConsentStatus = { UNKNOWN: 0, REQUIRED: 1, NOT_REQUIRED: 2, OBTAINED: 3 };

// Ad unit classes (static createForAdRequest factory)
module.exports.InterstitialAd = { createForAdRequest: makeAd };
module.exports.RewardedAd = { createForAdRequest: makeAd };
module.exports.RewardedInterstitialAd = { createForAdRequest: makeAd };
module.exports.AppOpenAd = { createForAdRequest: makeAd };

// Hooks / consent
module.exports.useForeground = () => {};
module.exports.AdsConsent = {
  requestInfoUpdate: () => Promise.resolve({ status: 2 }),
  loadAndShowConsentFormIfRequired: () => Promise.resolve({ status: 2 }),
  getConsentInfo: () => Promise.resolve({ status: 2 }),
  reset: () => {},
};
