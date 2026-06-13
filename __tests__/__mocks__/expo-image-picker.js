// Jest shim for expo-image-picker — native module not available in test environment
module.exports = {
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
};
