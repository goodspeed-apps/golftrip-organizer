/**
 * Expo config plugin: force AppDelegate.swift to use the embedded JS bundle
 * even in Debug builds.
 *
 * Why: iPhone 17 Pro / A19 chip has hardened ARM64 PAC (Pointer Authentication)
 * that the Release Hermes binary fails. The Debug Hermes binary is PAC-safe.
 * We ship a store-distribution IPA built with Xcode Debug configuration so the
 * Debug Hermes is linked. But default Debug AppDelegate looks for a Metro
 * server (which doesn't exist for an installed-from-TestFlight build) and
 * fails with "No script URL provided".
 *
 * This plugin rewrites the bundleURL() function so it always returns the
 * embedded main.jsbundle regardless of Debug/Release.
 *
 * References:
 * - https://github.com/facebook/hermes/issues/1966
 * - https://github.com/expo/expo/issues/44356
 * - https://github.com/expo/expo/issues/44680
 */

const { withAppDelegate } = require('@expo/config-plugins');

module.exports = function withForceEmbeddedBundle(config) {
  return withAppDelegate(config, (cfg) => {
    const original = cfg.modResults.contents;
    const patched = original.replace(
      /override func bundleURL\(\) -> URL\? \{\s*#if DEBUG\s*return RCTBundleURLProvider\.sharedSettings\(\)\.jsBundleURL\(forBundleRoot: "[^"]+"\)\s*#else\s*return Bundle\.main\.url\(forResource: "main", withExtension: "jsbundle"\)\s*#endif\s*\}/,
      'override func bundleURL() -> URL? {\n    // iOS 26 / iPhone 17 Pro PAC workaround: always use embedded bundle\n    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")\n  }'
    );
if (patched === original) {
      throw new Error('[with-force-embedded-bundle] failed to match AppDelegate.swift bundleURL pattern; check Expo SDK version and update the regex.');
    }

// Also suppress RCTDevLoadingView ("Connect to Metro to develop JavaScript."
    // banner shown during splash because we ship a Debug-config IPA) AND the
    // RCTDevMenu shake-to-show pop-up that surfaces in Debug-config builds.
    // Both are PAC-workaround side-effects: we ship Debug config so Hermes is
    // PAC-safe, but Debug enables every dev-mode UI that an end user must
    // never see.
let withDevDisabled = patched;
    if (!withDevDisabled.includes('RCTDevLoadingView.setEnabled(false)')) {
      withDevDisabled = withDevDisabled.replace(
        /(reactNativeDelegate = delegate\s+reactNativeFactory = factory)/,
        '$1\n\n    // PAC workaround side-effect: we ship Debug config; suppress dev UI.\n    RCTDevLoadingView.setEnabled(false)\n    // Disable shake-to-show dev menu after the bridge is up.\n    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {\n      if let bridge = factory.bridge {\n        bridge.devSettings?.isShakeToShowDevMenuEnabled = false\n      }\n    }'
      );
    }
    cfg.modResults.contents = withDevDisabled;
    return cfg;
  });
};
