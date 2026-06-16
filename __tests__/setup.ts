/**
 * GAS Template — Test Setup & Mock Factories
 *
 * Provides mock factories for all external dependencies.
 * Used by all test projects (lib, hooks, services, components).
 */

// ─── Mock AsyncStorage ────────────────────────────────────────────────────────

export function createMockAsyncStorage() {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { store.delete(key); }),
    clear: jest.fn(async () => { store.clear(); }),
    _store: store,
  };
}

// ─── Mock Supabase ────────────────────────────────────────────────────────────

// --- Configurable mock query response ---
let mockQueryResponse: { data: any; error: any; count: number } = { data: [], error: null, count: 0 };

/** Override the default mock query response for tests that need custom data. */
export function setMockQueryResponse(response: { data?: any; error?: any; count?: number }) {
  mockQueryResponse = { data: response.data ?? [], error: response.error ?? null, count: response.count ?? 0 };
}

export function createMockSupabase() {
  const queryBuilder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: any) => resolve(mockQueryResponse)),
  };

  return {
    from: jest.fn(() => queryBuilder),
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: 'test-user' } }, error: null })),
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      signInWithPassword: jest.fn(async () => ({ data: { session: null }, error: null })),
      signUp: jest.fn(async () => ({ data: { session: null }, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    functions: {
      invoke: jest.fn(async () => ({ data: {}, error: null })),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((cb?: any) => { cb?.('SUBSCRIBED'); return { unsubscribe: jest.fn() }; }),
      unsubscribe: jest.fn(),
    })),
    _queryBuilder: queryBuilder,
  };
}

// ─── Mock NetInfo ─────────────────────────────────────────────────────────────

export function createMockNetInfo(connected = true) {
  return {
    fetch: jest.fn(async () => ({
      isConnected: connected,
      isInternetReachable: connected,
      type: connected ? 'wifi' : 'none',
      details: connected ? { cellularGeneration: '4g' } : null,
    })),
    addEventListener: jest.fn(() => jest.fn()),
  };
}

// ─── Mock Router ──────────────────────────────────────────────────────────────

export function createMockRouter() {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    navigate: jest.fn(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Drain the microtask queue. */
export function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

// ─── Global Module Mocks ──────────────────────────────────────────────────────

const mockAsyncStorage = createMockAsyncStorage();
const mockSupabase = createMockSupabase();
const mockNetInfo = createMockNetInfo();

// Mock modules that are imported by the files under test
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('@react-native-community/netinfo', () => mockNetInfo);
jest.mock('../lib/supabase', () => ({ supabase: mockSupabase }));
jest.mock('../lib/posthog', () => ({
  captureEvent: jest.fn(),
  identifyUser: jest.fn(),
  resetUser: jest.fn(),
  posthog: null,
}));
jest.mock('../lib/sentry', () => ({
  initSentry: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
  sanitizeData: jest.fn((data: any) => data),
  SentryErrorBoundary: null,
}));
jest.mock('../lib/haptics', () => ({
  lightTap: jest.fn(),
  mediumTap: jest.fn(),
  heavyTap: jest.fn(),
  successFeedback: jest.fn(),
  errorFeedback: jest.fn(),
  selectionFeedback: jest.fn(),
}));
jest.mock('../lib/performance', () => ({
  trackScreenLoad: jest.fn(),
  trackApiLatency: jest.fn(),
  trackAppStartup: jest.fn(),
  PerformanceTracker: class { start() {} end() { return 0; } },
}));

// React Native mocks
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '17.0', select: (opts: any) => opts.ios },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Animated: (() => {
    // A complete RN Animated mock: components, an interpolatable Value, and the imperative
    // drivers (timing/spring/sequence/parallel/loop/stagger/delay). Skeleton/shimmer
    // components (LoadingSkeleton, StreakBadge, ConsentBanner) call Animated.sequence/loop on
    // mount — without these the screen throws "Animated.sequence is not a function" on render.
    const driver = () => ({ start: (cb?: any) => cb && cb({ finished: true }), stop: () => {}, reset: () => {} });
    return {
      Value: jest.fn(() => ({
        stopAnimation: jest.fn(), setValue: jest.fn(), setOffset: jest.fn(), flattenOffset: jest.fn(),
        addListener: jest.fn(() => '1'), removeListener: jest.fn(), removeAllListeners: jest.fn(),
        interpolate: jest.fn(() => ({ interpolate: jest.fn() })),
      })),
      ValueXY: jest.fn(() => ({ x: 0, y: 0, setValue: jest.fn(), getLayout: jest.fn(() => ({})) })),
      View: 'Animated.View', Text: 'Animated.Text', ScrollView: 'Animated.ScrollView', Image: 'Animated.Image',
      createAnimatedComponent: (c: any) => c,
      timing: jest.fn(driver), spring: jest.fn(driver), decay: jest.fn(driver),
      sequence: jest.fn(driver), parallel: jest.fn(driver), stagger: jest.fn(driver),
      loop: jest.fn(driver), delay: jest.fn(driver),
      event: jest.fn(() => jest.fn()),
    };
  })(),
  Keyboard: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
    dismiss: jest.fn(),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  Appearance: { getColorScheme: jest.fn(() => 'light'), addChangeListener: jest.fn(() => ({ remove: jest.fn() })) },
  Image: 'Image',
  Linking: { openURL: jest.fn(() => Promise.resolve()), canOpenURL: jest.fn(() => Promise.resolve(true)) },
  Modal: 'Modal',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  // Functional FlatList: actually renders its data via renderItem so screen tests can assert
  // list-row content (a bare 'FlatList' string renders nothing, so saved-break/list rows are
  // invisible and every list assertion fails). Honors ListEmptyComponent for empty states.
  FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent, ListHeaderComponent, ListFooterComponent, ...rest }: any) => {
    const React = require('react');
    const items = data || [];
    const node = (c: any) => (typeof c === 'function' ? React.createElement(c) : c ?? null);
    const children = items.length === 0
      ? node(ListEmptyComponent)
      : items.map((item: any, index: number) => {
          const key = keyExtractor ? keyExtractor(item, index) : String(index);
          return React.createElement(React.Fragment, { key }, renderItem({ item, index }));
        });
    return React.createElement('FlatList', rest, node(ListHeaderComponent), children, node(ListFooterComponent));
  },
  ScrollView: 'ScrollView',
  Switch: 'Switch',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  StyleSheet: { absoluteFill: {}, create: (s: any) => s, flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s ?? {}) },
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
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => {}),
  getStringAsync: jest.fn(async () => ''),
}));
jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn(async () => true),
  openURL: jest.fn(async () => {}),
  openSettings: jest.fn(async () => {}),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('expo-device', () => ({
  isDevice: true,
  deviceType: 1, // PHONE
  DeviceType: { PHONE: 1, TABLET: 2, DESKTOP: 3, TV: 4, UNKNOWN: 0 },
  modelName: 'iPhone 15',
  osName: 'iOS',
  osVersion: '17.0',
  brand: 'Apple',
  manufacturer: 'Apple',
}));
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
      ios: { buildNumber: '1' },
      android: { versionCode: 1 },
    },
  },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
  digestStringAsync: jest.fn(async () => 'abc123hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file://image.jpg', width: 200, height: 200, base64: null }],
  })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file://photo.jpg', width: 300, height: 300, base64: null }],
  })),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file://doc.pdf', name: 'doc.pdf', size: 1024, mimeType: 'application/pdf' }],
  })),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[xxx]' })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'notif-id'),
  setBadgeCountAsync: jest.fn(async () => {}),
  getBadgeCountAsync: jest.fn(async () => 0),
  AndroidImportance: { MAX: 5, HIGH: 4 },
}));
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getTrackingPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));
jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => {}),
  reloadAsync: jest.fn(async () => {}),
}));
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', regionCode: 'US' }]),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));
jest.mock('react-native-purchases', () => ({
  default: {
    configure: jest.fn(),
    logIn: jest.fn(async () => ({})),
    logOut: jest.fn(async () => ({})),
    getOfferings: jest.fn(async () => ({ current: null })),
    purchasePackage: jest.fn(async () => ({ customerInfo: {} })),
    restorePurchases: jest.fn(async () => ({})),
    getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
  },
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 1 },
}));
jest.mock('expo-file-system', () => ({
  documentDirectory: '/tmp/',
  writeAsStringAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
  EncodingType: { UTF8: 'utf8' },
}));
jest.mock('i18next', () => ({
  use: jest.fn().mockReturnThis(),
  init: jest.fn().mockReturnThis(),
  t: jest.fn((key: string) => key),
  changeLanguage: jest.fn(),
  language: 'en',
}));
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({ t: (key: string) => key, i18n: { language: 'en', changeLanguage: jest.fn() } })),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));
jest.mock('lucide-react-native', () => ({
  Shield: 'Shield',
  Bell: 'Bell',
  Trash2: 'Trash2',
  Star: 'Star',
  MessageCircle: 'MessageCircle',
  ChevronDown: 'ChevronDown',
  X: 'X',
  Clock: 'Clock',
  Sparkles: 'Sparkles',
  Share2: 'Share2',
  Sun: 'Sun',
  Moon: 'Moon',
  Smartphone: 'Smartphone',
  Eye: 'Eye',
  EyeOff: 'EyeOff',
}));
jest.mock('expo-image', () => ({
  Image: 'ExpoImage',
}));
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn((cb: any) => cb({ setExtra: jest.fn(), setContext: jest.fn() })),
  wrap: jest.fn((c: any) => c),
  Severity: { Info: 'info', Warning: 'warning', Error: 'error' },
}));
jest.mock('posthog-react-native', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    screen: jest.fn(),
  })),
}));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Pan: jest.fn(() => ({ onStart: jest.fn().mockReturnThis(), onUpdate: jest.fn().mockReturnThis(), onEnd: jest.fn().mockReturnThis() })), Pinch: jest.fn().mockReturnThis(), Tap: jest.fn(() => ({ numberOfTaps: jest.fn().mockReturnThis(), onEnd: jest.fn().mockReturnThis() })), Simultaneous: jest.fn() },
  GestureDetector: 'GestureDetector',
}));
jest.mock('react-native-reanimated', () => {
  // Reanimated 4's own /mock requires the native TurboModule (crashes in jest), so hand-roll
  // a complete one. The prior version crashed any animated screen on two counts:
  // (1) no __esModule:true, so Babel's interop wrapped it and `default.createAnimatedComponent`
  // resolved to undefined ("is not a function"); (2) Animated.View and chained entering builders
  // were missing. `chain` is a self-returning proxy so FadeIn.duration(300).springify() never throws.
  const chain: any = new Proxy(function () {}, { get: () => chain, apply: () => chain });
  const Animated: any = {
    createAnimatedComponent: (c: any) => c,
    View: 'Animated.View',
    ScrollView: 'Animated.ScrollView',
    Text: 'Animated.Text',
    Image: 'Animated.Image',
    call: () => {},
  };
  return {
    __esModule: true,
    default: Animated,
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: (fn: any) => (typeof fn === 'function' ? fn() : {}),
    useAnimatedProps: (fn: any) => (typeof fn === 'function' ? fn() : {}),
    useDerivedValue: (fn: any) => ({ value: typeof fn === 'function' ? fn() : fn }),
    useAnimatedScrollHandler: () => () => {},
    useAnimatedRef: () => ({ current: null }),
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    withDelay: (_d: any, v: any) => v,
    withRepeat: (v: any) => v,
    withSequence: (...a: any[]) => a[0],
    cancelAnimation: () => {},
    runOnJS: (fn: any) => fn,
    runOnUI: (fn: any) => fn,
    interpolate: () => 0,
    Extrapolate: { CLAMP: 'clamp' },
    Extrapolation: { CLAMP: 'clamp' },
    Easing: new Proxy({}, { get: () => () => 0 }),
    FadeIn: chain, FadeOut: chain, FadeInDown: chain, FadeInUp: chain,
    FadeOutDown: chain, FadeOutUp: chain, SlideInUp: chain, SlideOutUp: chain,
    SlideInDown: chain, SlideOutDown: chain, ZoomIn: chain, ZoomOut: chain,
    BounceIn: chain, LinearTransition: chain, Layout: chain,
    View: 'Animated.View', ScrollView: 'Animated.ScrollView', Text: 'Animated.Text',
  };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: 'SafeAreaProvider',
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: jest.fn(() => ({ top: 47, bottom: 34, left: 0, right: 0 })),
}));

// Export mocks for test access
export { mockAsyncStorage, mockSupabase, mockNetInfo };
