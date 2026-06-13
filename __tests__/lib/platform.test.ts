/**
 * Tests for lib/platform.ts
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '17.0' },
}));
jest.mock('expo-device', () => ({
  isDevice: true,
  deviceType: 1,
  DeviceType: { PHONE: 1, TABLET: 2 },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '2.1.0',
      ios: { buildNumber: '42' },
      android: { versionCode: 10 },
    },
  },
}));

import { isIOS, isAndroid, isWeb, platformVersion, isTablet, appVersion, buildNumber } from '../../lib/platform';

describe('platform constants', () => {
  test('isIOS is true for ios platform', () => {
    expect(isIOS).toBe(true);
  });

  test('isAndroid is false for ios platform', () => {
    expect(isAndroid).toBe(false);
  });

  test('isWeb is false for ios platform', () => {
    expect(isWeb).toBe(false);
  });

  test('platformVersion parses string version', () => {
    expect(platformVersion).toBe(17);
  });

  test('isTablet is false for phone device type', () => {
    expect(isTablet).toBe(false);
  });

  test('appVersion reads from expo config', () => {
    expect(appVersion).toBe('2.1.0');
  });

  test('buildNumber reads iOS build number', () => {
    expect(buildNumber).toBe('42');
  });
});
