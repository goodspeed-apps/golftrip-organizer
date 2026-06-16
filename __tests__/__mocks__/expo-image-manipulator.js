// Jest shim for expo-image-manipulator — native module not available in test environment
module.exports = {
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
};
