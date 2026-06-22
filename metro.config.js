const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });

// --- Web: stub native-only modules ---
// These modules have no web implementation and throw "Cannot find native
// module X" at import during `expo export --platform web` (and its Node static
// prerender), producing a blank preview. Redirect them to no-op web stubs so
// the JS/React tree renders; native features are inert on web. This branch only
// fires for platform === 'web', so native (ios/android) builds are unaffected.
const NATIVE_WEB_STUBS = {
  'expo-tracking-transparency': path.resolve(__dirname, 'web-stubs/expo-tracking-transparency.js'),
  'expo-notifications': path.resolve(__dirname, 'web-stubs/expo-notifications.js'),
  'react-native-purchases': path.resolve(__dirname, 'web-stubs/react-native-purchases.js'),
  'expo-apple-authentication': path.resolve(__dirname, 'web-stubs/expo-apple-authentication.js'),
  'expo-local-authentication': path.resolve(__dirname, 'web-stubs/expo-local-authentication.js'),
  'expo-store-review': path.resolve(__dirname, 'web-stubs/expo-store-review.js'),
  'expo-secure-store': path.resolve(__dirname, 'web-stubs/expo-secure-store.js'),
  // Native-only crash reporting: breaks the web bundle at import (white-screened
  // every route via lib/sentry's exports going undefined). Inert on web.
  '@sentry/react-native': path.resolve(__dirname, 'web-stubs/sentry-react-native.js'),
  // expo-battery: native-only hardware read; stub returns full-charging defaults.
  // Added 2026-05-28 after ShiftWake f1254e26 web render gate caught a blank root
  // caused by a module-level `import * as Battery from 'expo-battery'` from an
  // onboarding device-check screen.
  'expo-battery': path.resolve(__dirname, 'web-stubs/expo-battery.js'),
  // @react-native-community/datetimepicker: native UI component (UIDatePicker /
  // Calendar). Stub renders a plain <input type="date|time"> on web so generated
  // alarm / scheduling screens still mount their React tree.
  '@react-native-community/datetimepicker': path.resolve(__dirname, 'web-stubs/@react-native-community/datetimepicker.js'),
  // @react-native-async-storage/async-storage: native module (AsyncStorage on
  // iOS / SharedPreferences on Android). Added 2026-05-29 after ShiftWake
  // fae05251 web render gate caught a blank root caused by the splash route
  // calling AsyncStorage.getItem at module init with no web implementation.
  // Stub backs the same async API with window.localStorage.
  '@react-native-async-storage/async-storage': path.resolve(__dirname, 'web-stubs/@react-native-async-storage/async-storage.js'),
};

// --- Optional native deps: stub when not installed (all platforms) ---
// These are useful native libraries the codegen sometimes imports, but they are
// intentionally NOT declared as dependencies because each breaks the build or
// crashes without extra config (react-native-google-mobile-ads needs an AdMob
// app-id config plugin; react-native-ssl-pinning's Android build.gradle calls
// the removed jcenter() and pulls AFNetworking which fails on the iOS 26 SDK;
// jail-monkey is an optional enhancement lib/security.ts loads defensively). A
// bare unresolved import would fail Metro bundling, so route them to safe no-op
// stubs — but ONLY when the real package isn't installed, so a deliberate
// integration (real package added to package.json) still uses the real module.
const OPTIONAL_NATIVE_STUBS = {
  'react-native-google-mobile-ads': path.resolve(__dirname, 'native-stubs/react-native-google-mobile-ads.js'),
  'jail-monkey': path.resolve(__dirname, 'native-stubs/jail-monkey.js'),
  'react-native-ssl-pinning': path.resolve(__dirname, 'native-stubs/react-native-ssl-pinning.js'),
};
const _realDepPresent = {};
function realDepInstalled(name) {
  if (name in _realDepPresent) return _realDepPresent[name];
  try {
    require.resolve(name);
    _realDepPresent[name] = true;
  } catch {
    _realDepPresent[name] = false;
  }
  return _realDepPresent[name];
}

const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NATIVE_WEB_STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: NATIVE_WEB_STUBS[moduleName] };
  }
  if (OPTIONAL_NATIVE_STUBS[moduleName] && !realDepInstalled(moduleName)) {
    return { type: 'sourceFile', filePath: OPTIONAL_NATIVE_STUBS[moduleName] };
  }
  return baseResolveRequest
    ? baseResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
