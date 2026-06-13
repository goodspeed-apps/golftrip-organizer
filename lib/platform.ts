/**
 * GAS Template, Platform Utilities
 *
 * Device info, platform detection, and app version helpers.
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

/** Numeric OS version (e.g. 17 for iOS 17, 34 for Android 14). */
export const platformVersion: number = typeof Platform.Version === 'string'
  ? parseInt(Platform.Version, 10) || 0
  : Platform.Version;

/** True if device is a tablet (iPad, Android tablet). */
export const isTablet: boolean = Device.deviceType === Device.DeviceType.TABLET;

/** True if device has a notch or Dynamic Island. */
export const hasNotch: boolean = isIOS && platformVersion >= 11;

/** App version from expo config (e.g. "1.0.0"). */
export const appVersion: string = Constants.expoConfig?.version ?? '0.0.0';

/** Build number from expo config. */
export const buildNumber: string =
  (isIOS
    ? Constants.expoConfig?.ios?.buildNumber
    : Constants.expoConfig?.android?.versionCode?.toString()) ?? '1';
