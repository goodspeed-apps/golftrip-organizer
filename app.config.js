/**
 * Dynamic Expo config — reads from gas.config.ts
 *
 * This bridges gas.config.ts → Expo's app.json configuration.
 * The DevAgent generates gas.config.ts; this file should not be modified.
 */
const { gasConfig } = require('./gas.config');
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * camelCase font name -> Google/TTF family name (spaced).
 * "SpaceGrotesk" -> "Space Grotesk", "IBMPlexSans" -> "IBM Plex Sans", "Inter" -> "Inter".
 * Inline copy of lib/fonts.ts#fontFamilyName — app.config.js is CommonJS and
 * cannot import TS modules.
 * @param {string} name
 * @returns {string}
 */
function fontFamilyName(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

/**
 * Builds expo-font plugin entries for any baked TTFs present in assets/fonts/.
 * Weights 400 and 700 are checked; files must exist (fs.existsSync guard).
 * Returns [] when fonts are 'system'/'monospace' or no TTFs are found — so
 * the default template config adds no expo-font plugin at all.
 *
 * The installed expo-font plugin (v55.x) accepts:
 *   - ios.fonts: string[]  — paths to TTF files (registered in UIAppFonts plist)
 *   - android.fonts: FontObject[]  — {fontFamily, fontDefinitions:[{path,weight}]}
 *     (registered via ReactFontManager with explicit family names)
 *
 * @param {object} typography - gasConfig.design.typography
 * @returns {Array} array of [pluginName, props] tuples (empty if nothing to register)
 */
function bakedFontPlugins(typography) {
  const names = [...new Set(
    [typography.displayFont, typography.bodyFont]
      .filter((f) => f && f !== 'system' && f !== 'monospace')
  )];

  const iosPaths = [];
  const androidFontObjects = [];

  for (const name of names) {
    const fontDefinitions = [400, 700]
      .map((w) => ({ weight: w, p: `./assets/fonts/${name}-${w}.ttf` }))
      .filter(({ p }) => fs.existsSync(path.join(__dirname, p)))
      .map(({ weight, p }) => ({ path: p, weight }));

    if (fontDefinitions.length) {
      iosPaths.push(...fontDefinitions.map((d) => d.path));
      androidFontObjects.push({ fontFamily: fontFamilyName(name), fontDefinitions });
    }
  }

  if (!iosPaths.length) return [];

  return [['expo-font', {
    ios: { fonts: iosPaths },
    android: { fonts: androidFontObjects },
  }]];
}

function generatePrivacyInfoPlist(privacy) {
  const dataTypes = privacy.dataCategories.map(c => `
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>${c.type}</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <${c.linked ? 'true' : 'false'}/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <${c.tracking ? 'true' : 'false'}/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        ${c.purposes.map(p => `<string>${p}</string>`).join('\n        ')}
      </array>
    </dict>`).join('');

  const tracking = privacy.trackingDomains.length > 0 ? '<true/>' : '<false/>';
  const trackingDomains = privacy.trackingDomains.map(d => `<string>${d}</string>`).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>${dataTypes}
  </array>
  <key>NSPrivacyTracking</key>
  ${tracking}
  <key>NSPrivacyTrackingDomains</key>
  <array>
    ${trackingDomains}
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array><string>CA92.1</string></array>
    </dict>
  </array>
</dict>
</plist>
`;
}

function withPrivacyManifest(config) {
  return withDangerousMod(config, ['ios', async (cfg) => {
    const projectName = cfg.modRequest.projectName;
    const filePath = path.join(cfg.modRequest.platformProjectRoot, projectName, 'PrivacyInfo.xcprivacy');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, generatePrivacyInfoPlist(gasConfig.privacy));
    return cfg;
  }]);
}

const config = gasConfig;
const slug = config.app.slug;
const bundleSlug = slug.replace(/-/g, '_');

// Per-tenant override: customer apps ship under the customer's own reverse-domain
// bundle id (injected by the worker as GAS_BUNDLE_ID at build time so it matches
// their provisioning profile). In-house apps leave it unset and use com.goodspeed.<slug>.
const overrideBundleId = (process.env.GAS_BUNDLE_ID || '').trim() || null;

// Build plugins array based on enabled features
const plugins = [
  // iOS 26 PAC workaround (hermes#1966, expo#44356/44606/44680): forces
  // AppDelegate.swift to load the embedded JS bundle even in Debug-config
  // builds (we ship Debug builds so Hermes Debug binary, which is PAC-safe,
  // is linked). Also disables RCTDevLoadingView (Metro banner).
  './plugins/with-force-embedded-bundle',
  'expo-router',
  'expo-secure-store',
  [
    // Replaces the deprecated top-level `splash` key (removed in SDK 51+).
    'expo-splash-screen',
    {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: config.design.colors.primary,
    },
  ],
  [
    'expo-build-properties',
    {
      android: {
        // No kotlinVersion override: Expo SDK 55 picks a KSP-compatible Kotlin
        // 2.x default. Pinning 1.9.25 (SDK 52 era) broke `Run gradlew` (BUG-105).
        targetSdkVersion: 35,
        compileSdkVersion: 35,
      },
    },
  ],
];

if (config.features.auth.biometric.enabled) {
  plugins.push('expo-local-authentication');
}

if (config.features.auth.apple) {
  plugins.push('expo-apple-authentication');
}

if (config.features.pushNotifications.enabled) {
  plugins.push([
    'expo-notifications',
    {
      icon: './assets/images/notification-icon.png',
      color: config.design.colors.primary,
    },
  ]);
}

if (config.features.compliance.attDialog) {
  plugins.push([
    'expo-tracking-transparency',
    {
      userTrackingPermission:
        'This identifier will be used to deliver personalized ads to you.',
    },
  ]);
}

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  plugins.push([
    '@sentry/react-native/expo',
    {
      organization: process.env.SENTRY_ORG ?? 'goodspeed',
      project: process.env.SENTRY_PROJECT ?? slug,
    },
  ]);
}

if (!process.env.EAS_PROJECT_ID) {
  console.warn('[GAS] EAS_PROJECT_ID env var not set — OTA updates and EAS services will not work');
}

for (const fp of bakedFontPlugins(gasConfig.design.typography)) plugins.push(fp);

module.exports = ({ config: expoConfig }) => withPrivacyManifest({
  ...expoConfig,
  name: config.app.name,
  slug: slug,
  version: config.app.version,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: config.app.scheme || slug,
  userInterfaceStyle: 'automatic',
  owner: config.app.owner,
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: overrideBundleId || `com.goodspeed.${slug}`,
    usesAppleSignIn: config.features.auth.apple,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: config.design.colors.primary,
    },
    package: overrideBundleId || `com.goodspeed.${bundleSlug}`,
    blockedPermissions: [
      'android.permission.ACTIVITY_RECOGNITION',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins,
  experiments: {
    typedRoutes: true,
  },
updates: {
    enabled: true,
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID ?? 'YOUR_PROJECT_ID'}`,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: 'fingerprint',
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? 'YOUR_PROJECT_ID',
    },
  },
});
