// Mock for expo-local-authentication
module.exports = {
  hasHardwareAsync: async () => false,
  isEnrolledAsync: async () => false,
  authenticateAsync: async () => ({ success: false }),
  supportedAuthenticationTypesAsync: async () => [],
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC: 2 },
};
