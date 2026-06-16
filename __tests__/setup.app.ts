/**
 * App-project-only test setup (layered AFTER the shared setup.ts).
 *
 * Screen tests render REAL screens, which consume the template's own hooks/context on
 * mount (theme, auth, analytics, paywall, subscription). Without a working mock the screen
 * crashes — undefined colors, or a hook used with .mockReturnValue that was never a
 * jest.fn(). These hooks/contexts ship in EVERY generated app (they come from the template),
 * so we mock them here as jest.fn() with sane defaults. A screen renders without the test
 * touching the platform, and a test can still steer behavior via
 * (useAuth as jest.Mock).mockReturnValue(...) because each is already a jest.fn().
 *
 * This file is ONLY on the `app` jest project. The hooks/services/components projects keep
 * using setup.ts alone, so their tests of the REAL hook implementations are unaffected.
 */

// Full theme color set (mirrors context/ThemeContext LightColors). Every key resolves to a
// real color string so `colors.<anything>` is defined. Exposed BOTH spread at the top level
// (`const colors = useThemeColors()`) AND nested under `.colors`
// (`const { colors } = useThemeColors()`) — screens use it both ways.
const C = '#3b82f6';
const themeColors: Record<string, string> = {};
for (const k of [
  'primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textSecondary', 'border',
  'success', 'warning', 'error', 'textMuted', 'textFaint', 'textOnPrimary', 'buttonText',
  'surfaceText', 'surfaceElevated', 'surfaceSecondary', 'surfaceDark', 'card', 'borderAccent',
  'borderDark', 'shadow', 'tertiary', 'primaryMuted', 'secondaryMuted', 'tertiaryMuted',
  'positive', 'negative', 'positiveMuted', 'negativeMuted', 'divider', 'info', 'infoMuted',
  'disabled', 'placeholder', 'overlay', 'successMuted', 'errorMuted', 'accentMuted',
  'warningBackground', 'tertiaryBorder',
]) {
  themeColors[k] = C;
}

jest.mock('../context/ThemeContext', () => ({
  __esModule: true,
  useThemeColors: jest.fn(() => ({
    ...themeColors,
    colors: themeColors,
    resolved: 'light',
    preference: 'system',
    setTheme: jest.fn(),
    fontScale: 1,
    reducedMotion: false,
  })),
  useTheme: jest.fn(() => ({ resolved: 'light', preference: 'system', setTheme: jest.fn() })),
  ThemeProvider: ({ children }: { children?: unknown }) => children ?? null,
}));

jest.mock('../hooks/useAuth', () => ({
  __esModule: true,
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { user: { id: 'test-user-id' }, access_token: 'test-token' },
    loading: false,
    isAuthenticated: true,
    signIn: jest.fn(async () => ({})),
    signUp: jest.fn(async () => ({})),
    signOut: jest.fn(async () => {}),
    unlockBiometric: jest.fn(async () => true),
    promptBiometric: jest.fn(async () => true),
    setBiometricPreference: jest.fn(async () => {}),
  })),
}));

jest.mock('../hooks/useAnalytics', () => ({
  __esModule: true,
  useAnalytics: jest.fn(() => ({ track: jest.fn(), identify: jest.fn(), screen: jest.fn() })),
}));

jest.mock('../hooks/usePaywall', () => ({
  __esModule: true,
  usePaywall: jest.fn(() => ({
    showPaywall: jest.fn(),
    hidePaywall: jest.fn(),
    checkAccess: jest.fn(async () => true),
    checkUsageLimit: jest.fn(async () => ({ allowed: true, remaining: 99 })),
    checkProductOwnership: jest.fn(async () => true),
    checkCreditAccess: jest.fn(async () => true),
    getUser: jest.fn(async () => ({ id: 'test-user-id' })),
    getUserTier: jest.fn(async () => 'free'),
  })),
}));

jest.mock('../hooks/useSubscription', () => ({
  __esModule: true,
  useSubscription: jest.fn(() => ({
    isSubscribed: true,
    tier: 'pro',
    isTrialing: false,
    trialEndsAt: null,
    offerings: null,
    isPaid: true,
    isLifetime: false,
    ownedProducts: [],
    isLoading: false,
    error: null,
    purchase: jest.fn(async () => ({})),
    purchaseOneTime: jest.fn(async () => ({})),
    restore: jest.fn(async () => ({})),
    refresh: jest.fn(async () => {}),
  })),
}));
