const makeStub = require('./_stub');

// Push notifications are native-only here; inert on web.
const perm = { status: 'undetermined', granted: false, canAskAgain: true, expires: 'never', ios: {}, android: {} };
const subscription = { remove() {} };

module.exports = makeStub({
  getPermissionsAsync: async () => perm,
  requestPermissionsAsync: async () => perm,
  getExpoPushTokenAsync: async () => ({ data: '', type: 'expo' }),
  getDevicePushTokenAsync: async () => ({ data: '', type: 'web' }),
  setNotificationHandler: () => {},
  addNotificationReceivedListener: () => subscription,
  addNotificationResponseReceivedListener: () => subscription,
  addNotificationsDroppedListener: () => subscription,
  removeNotificationSubscription: () => {},
  scheduleNotificationAsync: async () => 'stub-notification-id',
  cancelScheduledNotificationAsync: async () => {},
  cancelAllScheduledNotificationsAsync: async () => {},
  dismissAllNotificationsAsync: async () => {},
  dismissNotificationAsync: async () => {},
  getAllScheduledNotificationsAsync: async () => [],
  getPresentedNotificationsAsync: async () => [],
  setNotificationChannelAsync: async () => null,
  getNotificationChannelsAsync: async () => [],
  getLastNotificationResponseAsync: async () => null,
  setBadgeCountAsync: async () => true,
  getBadgeCountAsync: async () => 0,
  AndroidImportance: { UNSPECIFIED: -1000, NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
  AndroidNotificationVisibility: { UNKNOWN: 0, PUBLIC: 1, PRIVATE: 2, SECRET: 3 },
  SchedulableTriggerInputTypes: {
    DATE: 'date', TIME_INTERVAL: 'timeInterval', DAILY: 'daily',
    WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly', CALENDAR: 'calendar',
  },
  PermissionStatus: { GRANTED: 'granted', UNDETERMINED: 'undetermined', DENIED: 'denied' },
});
