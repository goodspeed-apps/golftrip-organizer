/**
 * Tests for lib/notifications.ts
 */

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[xxx]' })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'notif-id'),
  setBadgeCountAsync: jest.fn(async () => {}),
  getBadgeCountAsync: jest.fn(async () => 3),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5 },
}));
jest.mock('expo-device', () => ({ isDevice: true, deviceType: 1, DeviceType: { PHONE: 1, TABLET: 2, DESKTOP: 3, TV: 4, UNKNOWN: 0 }, modelName: 'iPhone 15' }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../../lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }));
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));
// Pin gas.config to the TEMPLATE notification values the assertions below expect.
// A generated app may customize features.pushNotifications.channels (the impl uses
// channels[0] as LOCAL_CHANNEL_ID and iterates channels to create Android channels),
// which would otherwise make the `channelId: 'default'` assertions fail. Provide only
// the fields the implementation reads, hoisted above the implementation import.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    features: {
      pushNotifications: { enabled: true, channels: ['default'] },
    },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

import * as ExpoNotifications from 'expo-notifications';
import { requestPermissionAndRegister, scheduleLocalNotification, getBadgeCount, setBadgeCount } from '../../lib/notifications';

beforeEach(() => jest.clearAllMocks());

describe('requestPermissionAndRegister', () => {
  test('returns token when permission granted', async () => {
    const token = await requestPermissionAndRegister('user-1');
    expect(token).toBe('ExponentPushToken[xxx]');
  });

  test('creates Android notification channels', async () => {
    await requestPermissionAndRegister('user-1');
    expect(ExpoNotifications.setNotificationChannelAsync).toHaveBeenCalled();
  });

  test('returns null when not a device', async () => {
    const Device = require('expo-device');
    const original = Device.isDevice;
    Device.isDevice = false;
    const token = await requestPermissionAndRegister('user-1');
    expect(token).toBeNull();
    Device.isDevice = original;
  });

  test('returns null when permission denied', async () => {
    (ExpoNotifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (ExpoNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const token = await requestPermissionAndRegister('user-1');
    expect(token).toBeNull();
  });
});

describe('scheduleLocalNotification', () => {
  test('schedules and returns identifier', async () => {
    const id = await scheduleLocalNotification('Test', 'Body', { type: 'timeInterval', seconds: 60, repeats: false } as any);
    expect(id).toBe('notif-id');
    expect(ExpoNotifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  test('attaches the Android channel to the trigger so the OS does not drop it', async () => {
    await scheduleLocalNotification('Test', 'Body', { type: 'timeInterval', seconds: 2 } as any);
    const arg = (ExpoNotifications.scheduleNotificationAsync as jest.Mock).mock.calls.at(-1)![0];
    expect(arg.trigger).toMatchObject({ channelId: 'default', seconds: 2 });
  });

  test('maps a null/immediate trigger to a channel-aware immediate trigger on Android', async () => {
    await scheduleLocalNotification('Test', 'Body', null);
    const arg = (ExpoNotifications.scheduleNotificationAsync as jest.Mock).mock.calls.at(-1)![0];
    expect(arg.trigger).toEqual({ channelId: 'default' });
  });

  test('creates the Android channel before scheduling (fresh module, no prior register call)', async () => {
    jest.resetModules();
    const Expo = require('expo-notifications');
    (Expo.setNotificationChannelAsync as jest.Mock).mockClear();
    const fresh = require('../../lib/notifications');
    await fresh.scheduleLocalNotification('Test', 'Body', null);
    expect(Expo.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.objectContaining({ importance: 5 }));
  });
});

describe('badge count', () => {
  test('getBadgeCount returns count', async () => {
    const count = await getBadgeCount();
    expect(count).toBe(3);
  });

  test('setBadgeCount calls setBadgeCountAsync', async () => {
    await setBadgeCount(5);
    expect(ExpoNotifications.setBadgeCountAsync).toHaveBeenCalledWith(5);
  });
});
