const makeStub = require('./_stub');

// App Tracking Transparency is iOS-only; on web there is no tracking prompt.
const status = { status: 'unavailable', granted: false, canAskAgain: false, expires: 'never' };

module.exports = makeStub({
  requestTrackingPermissionsAsync: async () => status,
  getTrackingPermissionsAsync: async () => status,
  getAdvertisingId: () => null,
  isAvailable: () => false,
  useTrackingPermissions: () => [status, async () => status],
  PermissionStatus: { GRANTED: 'granted', UNDETERMINED: 'undetermined', DENIED: 'denied' },
});
