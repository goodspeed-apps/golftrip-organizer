/**
 * GAS Template, Security Utilities
 *
 * Device security checks, jailbreak/root detection, certificate pinning
 * configuration, and screen capture prevention.
 *
 * Optional dependencies:
 * - expo-screen-capture (for preventScreenCapture)
 * - expo-file-system (for path-based detection)
 * - jail-monkey (for comprehensive native jailbreak/root detection)
 *
 * Detection strategy:
 * 1. If `jail-monkey` is installed, use its native detection (most reliable)
 * 2. Otherwise, fall back to heuristic path/URL checks
 */

import { Platform, Linking } from 'react-native';
import * as Device from 'expo-device';
import { addBreadcrumb } from './sentry';
import { isWeb } from './platform';
import { gasConfig } from '../gas.config';

// Try to require optional deps
let ScreenCapture: any = null;
try { ScreenCapture = require('expo-screen-capture'); } catch { /* not installed */ }

let FileSystem: any = null;
try { FileSystem = require('expo-file-system'); } catch { /* not installed */ }

let JailMonkey: any = null;
try { JailMonkey = require('jail-monkey'); } catch { /* not installed */ }

// ─── Jailbreak/Root Indicators ───────────────────────────────────────────────

// Expanded jailbreak indicators for iOS
const JAILBREAK_PATHS = [
  // Package managers
  '/Applications/Cydia.app',
  '/Applications/Sileo.app',
  '/Applications/Zebra.app',
  '/Applications/Installer.app',
  '/Applications/Unc0ver.app',
  '/Applications/checkra1n.app',
  // Substrate/Substitute
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/Library/MobileSubstrate/DynamicLibraries/',
  '/usr/lib/substitute-inserter.dylib',
  '/usr/lib/TweakInject.dylib',
  // Common jailbreak binaries
  '/bin/bash',
  '/bin/sh',
  '/usr/sbin/sshd',
  '/usr/bin/ssh',
  '/usr/bin/sshd',
  '/usr/libexec/ssh-keysign',
  '/usr/sbin/frida-server',
  '/usr/bin/cycript',
  // APT and package management
  '/etc/apt',
  '/etc/apt/sources.list.d/',
  '/private/var/lib/apt/',
  '/private/var/lib/cydia/',
  '/var/lib/dpkg/info',
  // Other indicators
  '/private/var/stash',
  '/private/var/tmp/cydia.log',
  '/var/cache/apt/',
  '/var/log/syslog',
  '/jb/lzma',
  '/usr/local/bin/cycript',
];

// Expanded root indicators for Android
const ROOT_INDICATORS = [
  // su binaries
  '/system/app/Superuser.apk',
  '/system/app/SuperSU.apk',
  '/system/app/Magisk.apk',
  '/sbin/su',
  '/system/bin/su',
  '/system/xbin/su',
  '/data/local/xbin/su',
  '/data/local/bin/su',
  '/system/sd/xbin/su',
  '/su/bin/su',
  '/su/bin',
  // Magisk
  '/sbin/.magisk',
  '/data/adb/magisk',
  '/cache/.disable_magisk',
  // BusyBox
  '/system/xbin/busybox',
  '/system/bin/busybox',
  // Root management apps
  '/system/app/KingRoot.apk',
  '/system/app/KingoRoot.apk',
  '/data/data/com.topjohnwu.magisk',
  '/data/data/eu.chainfire.supersu',
  '/data/data/com.koushikdutta.superuser',
  '/data/data/com.noshufou.android.su',
  // Frida
  '/data/local/tmp/frida-server',
];

// Jailbreak-related URL schemes to check on iOS
const JAILBREAK_URL_SCHEMES = [
  'cydia://',
  'sileo://',
  'zbra://',       // Zebra
  'undecimus://',  // unc0ver
];

// ─── Detection Functions ─────────────────────────────────────────────────────

/**
 * Jailbreak/root detection.
 *
 * Strategy:
 * 1. If `jail-monkey` is installed, use its native detection (most reliable)
 * 2. Otherwise, fall back to expanded heuristic path/URL checks
 *
 * iOS: checks for jailbreak URL schemes and common jailbreak file paths.
 * Android: checks for su binaries, root management apps, and Magisk indicators.
 *
 * Note: Heuristic detection is not foolproof against sophisticated bypasses
 * (e.g., hiding root with Magisk Hide). For production-critical security,
 * install `jail-monkey` as an optional peer dependency.
 */
export async function isDeviceRooted(): Promise<boolean> {
  if (isWeb || !Device.isDevice) return false;

  // Strategy 1: Use jail-monkey if available (most comprehensive)
  if (JailMonkey) {
    try {
      const isJailBroken = JailMonkey.isJailBroken?.();
      if (isJailBroken === true) {
        addBreadcrumb('security', 'Device root/jailbreak detected (jail-monkey)');
        return true;
      }
      // jail-monkey returned false, trust its native detection
      return false;
    } catch {
      // jail-monkey failed, fall through to heuristic detection
      addBreadcrumb('security', 'jail-monkey detection failed, falling back to heuristics');
    }
  }

  // Strategy 2: Heuristic detection
  try {
    if (Platform.OS === 'ios') {
      // Check for jailbreak URL schemes
      for (const scheme of JAILBREAK_URL_SCHEMES) {
        const canOpen = await Linking.canOpenURL(scheme).catch(() => false);
        if (canOpen) {
          addBreadcrumb('security', `Jailbreak URL scheme detected: ${scheme}`);
          return true;
        }
      }

      // Check for common jailbreak paths
      if (FileSystem) {
        for (const path of JAILBREAK_PATHS) {
          const info = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }));
          if (info.exists) {
            addBreadcrumb('security', `Jailbreak path detected: ${path}`);
            return true;
          }
        }
      }
    } else if (Platform.OS === 'android') {
      // Check for common root paths
      if (FileSystem) {
        for (const path of ROOT_INDICATORS) {
          const info = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }));
          if (info.exists) {
            addBreadcrumb('security', `Root indicator detected: ${path}`);
            return true;
          }
        }
      }
    }
  } catch {
    // Detection failed, assume not rooted
    addBreadcrumb('security', 'Heuristic root detection failed');
  }

  return false;
}

/** Get a security level assessment based on device capabilities. */
export async function getSecurityLevel(): Promise<'high' | 'medium' | 'low'> {
  if (!Device.isDevice) return 'low';
  if (await isDeviceRooted()) return 'low';

  // Medium if running in debug mode on a physical device
  if (typeof __DEV__ !== 'undefined' && __DEV__) return 'medium';

  return 'high';
}

// ─── Security Recommendations ────────────────────────────────────────────────

export interface SecurityRecommendation {
  level: 'critical' | 'warning' | 'info';
  message: string;
  action?: string;
}

/**
 * Get actionable security recommendations based on the current device state.
 *
 * Returns an array of recommendations sorted by severity (critical first).
 * Use these to show security warnings in settings or during onboarding.
 */
export async function getSecurityRecommendations(): Promise<SecurityRecommendation[]> {
  const recommendations: SecurityRecommendation[] = [];

  if (isWeb) {
    recommendations.push({
      level: 'info',
      message: 'Running in web browser. Some security features are not available.',
    });
    return recommendations;
  }

  if (!Device.isDevice) {
    recommendations.push({
      level: 'warning',
      message: 'Running on a simulator/emulator. Security checks are limited.',
      action: 'Test on a physical device for accurate security assessment.',
    });
    return recommendations;
  }

  // Check for root/jailbreak
  const rooted = await isDeviceRooted();
  if (rooted) {
    recommendations.push({
      level: 'critical',
      message: 'This device appears to be jailbroken/rooted. Your data may be at risk.',
      action: 'For maximum security, use an unmodified device.',
    });
  }

  // Check for biometric availability
  if (gasConfig.features.auth.biometric.enabled) {
    try {
      const LocalAuth = require('expo-local-authentication');
      const hasHardware = await LocalAuth.hasHardwareAsync();
      const isEnrolled = await LocalAuth.isEnrolledAsync();

      if (!hasHardware) {
        recommendations.push({
          level: 'info',
          message: 'Biometric authentication is not available on this device.',
        });
      } else if (!isEnrolled) {
        recommendations.push({
          level: 'warning',
          message: 'No biometric data enrolled. App lock is using device passcode.',
          action: 'Enroll fingerprint or face recognition in device Settings.',
        });
      }
    } catch {
      // expo-local-authentication not available
    }
  }

  // Check if jail-monkey is available for comprehensive detection
  if (!JailMonkey) {
    recommendations.push({
      level: 'info',
      message: 'Enhanced root detection (jail-monkey) is not installed. Using heuristic detection.',
      action: 'Install jail-monkey for more comprehensive jailbreak/root detection.',
    });
  }

  // Check for debug mode
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    recommendations.push({
      level: 'info',
      message: 'Running in development mode. Debug features are enabled.',
    });
  }

  // Sort: critical first, then warning, then info
  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  recommendations.sort((a, b) => order[a.level] - order[b.level]);

  return recommendations;
}

// ─── Certificate Pinning ─────────────────────────────────────────────────────

/**
 * Certificate pinning check.
 *
 * If gasConfig.features.security?.certificatePinning is enabled, this
 * verifies that `react-native-ssl-pinning` is installed and logs a warning
 * if it is not.
 *
 * Certificate pinning requires a native module (e.g., react-native-ssl-pinning)
 * and cannot be implemented in pure JS.
 *
 * To implement:
 * 1. Install `react-native-ssl-pinning`
 * 2. Add your server's certificate SHA-256 fingerprint to the native config
 * 3. Replace fetch calls with the pinning library's fetch for sensitive endpoints
 *
 * @see https://github.com/nickkle/react-native-ssl-pinning
 */
export function checkCertificatePinning(): void {
  const pinningEnabled = (gasConfig.features as any).security?.certificatePinning;

  if (pinningEnabled) {
    let sslPinning: any = null;
    try { sslPinning = require('react-native-ssl-pinning'); } catch { /* not installed */ }

    if (!sslPinning) {
      if (__DEV__) {
        console.warn(
          '[security] Certificate pinning is ENABLED in config but ' +
          'react-native-ssl-pinning is not installed. ' +
          'Install it with: npx expo install react-native-ssl-pinning'
        );
      }
      addBreadcrumb('security', 'Certificate pinning enabled but native module missing');
    } else {
      addBreadcrumb('security', 'Certificate pinning module available');
    }
  } else {
    addBreadcrumb('security', 'Certificate pinning is not enabled in config');
  }
}

// ─── Screen Capture Prevention ───────────────────────────────────────────────

/** Prevent screen capture. No-op if expo-screen-capture not installed. */
export async function preventScreenCapture(): Promise<void> {
  if (!ScreenCapture) return;
  try {
    await ScreenCapture.preventScreenCaptureAsync();
    addBreadcrumb('security', 'Screen capture prevention enabled');
  } catch {
    // Not available on this platform
  }
}

/** Allow screen capture again. No-op if expo-screen-capture not installed. */
export async function allowScreenCapture(): Promise<void> {
  if (!ScreenCapture) return;
  try {
    await ScreenCapture.allowScreenCaptureAsync();
  } catch {
    // Not available
  }
}
