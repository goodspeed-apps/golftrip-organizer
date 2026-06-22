// Minimal nativewind mock for Jest component tests
module.exports = {
  useColorScheme: () => ({ colorScheme: 'light', setColorScheme: jest.fn() }),
  cssInterop: (component) => component,
  remapProps: (component) => component,
};
