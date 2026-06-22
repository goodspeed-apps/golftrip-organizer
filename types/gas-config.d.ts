/**
 * GAS Template — Typed configuration schema
 * All types consumed by gas.config.ts and the rest of the app.
 */

// ─── App ──────────────────────────────────────────────────────────────────────

export interface GasAppConfig {
  name: string;
  slug: string;
  scheme: string;
  version: string;
  description: string;
  icon: string;
  splash: string;
  bundleId: {
    ios: string;
    android: string;
  };
}

// ─── Design ───────────────────────────────────────────────────────────────────

export interface GasColorPalette {
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  background: string;
  backgroundDark: string;
  surface: string;
  surfaceDark: string;
  text: string;
  textDark: string;
  textSecondary: string;
  textSecondaryDark: string;
  border: string;
  borderDark: string;
  success: string;
  warning: string;
  error: string;
  [key: string]: string;
}

export interface GasTypography {
  headingWeight: '400' | '500' | '600' | '700' | '800' | '900';
  fontFamily?: string;
  displayFontFamily?: string;
}

export interface GasLayout {
  spacing: 'compact' | 'comfortable' | 'spacious';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export interface GasDesignConfig {
  colors: GasColorPalette;
  typography: GasTypography;
  layout: GasLayout;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface GasTabConfig {
  id: string;
  label: string;
  icon: string;
  file: string;
}

export interface GasNavigationConfig {
  tabs: GasTabConfig[];
  modals: string[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface GasBiometricConfig {
  enabled: boolean;
  timeoutMinutes: number;
}

export interface GasAuthConfig {
  email: boolean;
  google: boolean;
  apple: boolean;
  twitter: boolean;
  linkedin: boolean;
  microsoft: boolean;
  biometric: GasBiometricConfig;
  mfa?: boolean;
}

// ─── IAP / Monetisation ───────────────────────────────────────────────────────

export interface GasIAPTier {
  name: string;
  productId: string;
  price: string;
  features: string[];
  highlighted?: boolean;
}

export interface GasOneTimePurchase {
  id: string;
  productId: string;
  type: string;
  name: string;
  description?: string;
  price: string;
}

export interface GasCreditPack {
  id: string;
  productId: string;
  credits: number;
  bonusCredits?: number;
  price: string;
  name?: string;
}

export interface GasCreditsConfig {
  enabled: boolean;
  packs: GasCreditPack[];
}

export interface GasIAPConfig {
  enabled: boolean;
  tiers: GasIAPTier[];
  oneTimePurchases?: GasOneTimePurchase[];
  credits?: GasCreditsConfig;
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface GasMarketplaceConfig {
  enabled: boolean;
  platformFeePercent: number;
  listingCategories: string[];
  sellerPayoutMethod: string;
  [key: string]: unknown;
}

// ─── Features ─────────────────────────────────────────────────────────────────

export interface GasAnalyticsConfig {
  enabled: boolean;
  provider?: string;
}

export interface GasAdsConfig {
  enabled: boolean;
  provider: 'admob' | string;
  bannerAdUnitId?: string;
  interstitialAdUnitId?: string;
}

export interface GasDarkModeConfig {
  enabled: boolean;
  default?: 'light' | 'dark' | 'system';
}

export interface GasGamificationConfig {
  enabled: boolean;
  elements: string[];
}

export interface GasSearchConfig {
  enabled: boolean;
  entities: string[];
}

export interface GasI18nConfig {
  enabled: boolean;
  locales: string[];
  defaultLocale: string;
}

export interface GasOnboardingConfig {
  enabled: boolean;
  steps: string[];
}

export interface GasPushNotificationsConfig {
  enabled: boolean;
  provider?: string;
}

export interface GasFeaturesConfig {
  analytics: GasAnalyticsConfig;
  inAppPurchases: GasIAPConfig;
  darkMode: GasDarkModeConfig;
  gamification: GasGamificationConfig;
  search: GasSearchConfig;
  i18n: GasI18nConfig;
  onboarding: GasOnboardingConfig;
  auth: GasAuthConfig;
  ads: GasAdsConfig;
  helpSystem: boolean;
  csvExport?: boolean;
  pushNotifications?: GasPushNotificationsConfig;
  marketplace?: GasMarketplaceConfig;
  showBuiltWithBadge?: boolean;
  [key: string]: unknown;
}

// ─── Backend ──────────────────────────────────────────────────────────────────

export interface GasSupabaseConfig {
  url: string;
  anonKey: string;
}

export interface GasBackendConfig {
  supabase: GasSupabaseConfig;
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export interface GasAccountDeletionGracePeriod {
  days: number;
  allowImmediate: boolean;
}

export interface GasCompliance {
  gdprConsent: boolean;
  ccpaNotice: boolean;
  accountDeletionGracePeriod: GasAccountDeletionGracePeriod;
  [key: string]: unknown;
}

// ─── Legal ────────────────────────────────────────────────────────────────────

export interface GasLegalConfig {
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  [key: string]: unknown;
}

// ─── LLM ─────────────────────────────────────────────────────────────────────

export interface GasLLMConfig {
  provider?: string;
  defaultChatModel?: string;
  defaultEmbedModel?: string;
  defaultTranscribeModel?: string;
  defaultMaxTokens?: number;
  budgetPeriod?: string;
  costScope?: string;
  [key: string]: unknown;
}

// ─── Release Channels ─────────────────────────────────────────────────────────

export interface GasStoreUrlConfig {
  ios?: string;
  android?: string;
}

export interface GasReleaseChannelsConfig {
  storeUrl?: GasStoreUrlConfig;
  [key: string]: unknown;
}

// ─── Root config ─────────────────────────────────────────────────────────────

export interface GasConfig {
  app: GasAppConfig;
  design: GasDesignConfig;
  navigation: GasNavigationConfig;
  features: GasFeaturesConfig;
  backend: GasBackendConfig;
  compliance: GasCompliance;
  legal?: GasLegalConfig;
  llm: GasLLMConfig;
  releaseChannels?: GasReleaseChannelsConfig;
  [key: string]: unknown;
}
