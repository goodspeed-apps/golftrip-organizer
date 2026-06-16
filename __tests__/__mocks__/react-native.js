// Mock for react-native — avoids native module bindings in Jest
module.exports = {
  __esModule: true,
  Platform: { OS: 'ios', Version: '17.0', select: (opts) => opts.ios ?? opts.default },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Animated: {
    Value: jest.fn(() => ({ stopAnimation: jest.fn(), setValue: jest.fn() })),
    View: 'Animated.View',
    spring: jest.fn(() => ({ start: jest.fn() })),
    timing: jest.fn(() => ({ start: jest.fn() })),
  },
  Keyboard: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
    dismiss: jest.fn(),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
Appearance: { getColorScheme: jest.fn(() => 'light'), addChangeListener: jest.fn(() => ({ remove: jest.fn() })) },
  Linking: { openURL: jest.fn(() => Promise.resolve()), canOpenURL: jest.fn(() => Promise.resolve(true)) },
Image: 'Image',
  Modal: 'Modal',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  FlatList: ({ data, renderItem, keyExtractor, ...rest }) => {
    const React = require('react');
    return React.createElement('FlatList', rest, (data || []).map((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : String(index);
      return React.createElement(React.Fragment, { key }, renderItem({ item, index }));
    }));
  },
  ScrollView: 'ScrollView',
  Switch: 'Switch',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  StyleSheet: { absoluteFill: {}, create: (s) => s, flatten: (s) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s ?? {}) },
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  NativeModules: {},
  NativeEventEmitter: class {
    addListener() { return { remove: () => {} }; }
    removeAllListeners() {}
  },
  DeviceEventEmitter: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
    emit: jest.fn(),
  },
};
