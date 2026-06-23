// Mock for expo-updates
module.exports = {
  runtimeVersion: undefined,
  isEnabled: false,
  isEmbeddedLaunch: true,
  isUsingEmbeddedAssets: true,
  manifest: null,
  checkForUpdateAsync: jest.fn(() => Promise.resolve({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(() => Promise.resolve({ isNew: false })),
  reloadAsync: jest.fn(() => Promise.resolve()),
};
