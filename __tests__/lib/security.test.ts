/**
 * Tests for lib/security.ts
 */

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-device', () => ({ isDevice: true, deviceType: 1, DeviceType: { PHONE: 1, TABLET: 2, DESKTOP: 3, TV: 4, UNKNOWN: 0 }, modelName: 'iPhone 15' }));
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn() }));

import { isDeviceRooted, getSecurityLevel, preventScreenCapture, allowScreenCapture } from '../../lib/security';

describe('isDeviceRooted', () => {
  test('returns false (basic detection)', async () => {
    expect(await isDeviceRooted()).toBe(false);
  });
});

describe('getSecurityLevel', () => {
  test('returns high for real device', async () => {
    expect(await getSecurityLevel()).toBe('high');
  });
});

describe('preventScreenCapture', () => {
  test('runs without error when dep not installed', async () => {
    await expect(preventScreenCapture()).resolves.toBeUndefined();
  });
});

describe('allowScreenCapture', () => {
  test('runs without error when dep not installed', async () => {
    await expect(allowScreenCapture()).resolves.toBeUndefined();
  });
});
