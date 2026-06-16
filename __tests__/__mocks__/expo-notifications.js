// Mock for expo-notifications
const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const getPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const getExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-token-abc]' });
const addNotificationResponseReceivedListener = jest.fn().mockReturnValue({ remove: jest.fn() });
const addNotificationReceivedListener = jest.fn().mockReturnValue({ remove: jest.fn() });
const setNotificationHandler = jest.fn();
const scheduleNotificationAsync = jest.fn().mockResolvedValue('notification-id');
const cancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);
const cancelAllScheduledNotificationsAsync = jest.fn().mockResolvedValue(undefined);
const getBadgeCountAsync = jest.fn().mockResolvedValue(0);
const setBadgeCountAsync = jest.fn().mockResolvedValue(true);

module.exports = {
  requestPermissionsAsync,
  getPermissionsAsync,
  getExpoPushTokenAsync,
  addNotificationResponseReceivedListener,
  addNotificationReceivedListener,
  setNotificationHandler,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  getBadgeCountAsync,
  setBadgeCountAsync,
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
};
