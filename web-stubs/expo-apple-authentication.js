const makeStub = require('./_stub');

// Sign in with Apple is iOS-only. On web the button renders nothing and the
// flow reports unavailable; callers gate on isAvailableAsync()/Platform.OS.
module.exports = makeStub({
  isAvailableAsync: async () => false,
  signInAsync: async () => { throw new Error('Apple authentication is unavailable on web'); },
  refreshAsync: async () => { throw new Error('Apple authentication is unavailable on web'); },
  signOutAsync: async () => {},
  getCredentialStateAsync: async () => 0,
  addRevokeListener: () => ({ remove() {} }),
  // Rendered component must return a valid React element on web, not a Promise.
  AppleAuthenticationButton: () => null,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationCredentialState: { REVOKED: 0, AUTHORIZED: 1, NOT_FOUND: 2, TRANSFERRED: 3 },
  AppleAuthenticationOperation: { IMPLICIT: 0, LOGIN: 1, REFRESH: 2, LOGOUT: 3 },
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
});
