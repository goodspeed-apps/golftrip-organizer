// Mock for expo-apple-authentication
module.exports = {
  isAvailableAsync: async () => false,
  signInAsync: async () => ({ user: 'mock-user', identityToken: 'mock-token', email: null }),
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
  AppleAuthenticationCredentialState: {
    AUTHORIZED: 1,
    REVOKED: 0,
    NOT_FOUND: -1,
    TRANSFERRED: 2,
  },
};
