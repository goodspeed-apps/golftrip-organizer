const makeStub = require('./_stub');

// Biometric (Face ID / Touch ID / fingerprint) is native-only; absent on web.
module.exports = makeStub({
  hasHardwareAsync: async () => false,
  isEnrolledAsync: async () => false,
  authenticateAsync: async () => ({ success: false, error: 'not_available' }),
  supportedAuthenticationTypesAsync: async () => [],
  cancelAuthenticate: async () => {},
  getEnrolledLevelAsync: async () => 0,
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
});
