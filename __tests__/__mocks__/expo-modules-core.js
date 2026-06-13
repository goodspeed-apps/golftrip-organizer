// Mock for expo-modules-core — prevents native EventEmitter from loading in Jest
module.exports = {
  EventEmitter: class {
    addListener() { return { remove: () => {} }; }
    removeAllListeners() {}
    emit() {}
  },
  requireOptionalNativeModule: () => null,
  requireNativeModule: () => ({}),
  CodedError: class CodedError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
  UnavailabilityError: class UnavailabilityError extends Error {
    constructor(moduleName, propertyName) {
      super(`${moduleName}.${propertyName} is not available`);
    }
  },
  NativeModulesProxy: {},
  Platform: { OS: 'ios' },
};
