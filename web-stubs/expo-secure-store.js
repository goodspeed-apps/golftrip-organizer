const makeStub = require('./_stub');

// expo-secure-store wraps the device keychain/keystore (native-only). On web it
// is inert: reads return null, writes are dropped. Auth-token persistence on web
// is handled separately by lib/supabase.ts via localStorage.
module.exports = makeStub({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
  isAvailableAsync: async () => false,
  canUseBiometricAuthentication: () => false,
  WHEN_UNLOCKED: 'whenUnlocked',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
  AFTER_FIRST_UNLOCK: 'afterFirstUnlock',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
});
