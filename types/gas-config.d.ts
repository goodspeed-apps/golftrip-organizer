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
}

export interface GasTypography {
  headingFont: string;
  bodyFont: string;
  headingWeight: '400' | '500' | '600' | '700' | '800' | '900';
  scale: 'compact' | 'comfortable' | 'spacious';
}

export interface GasLayout {
  spacing: 'compact' | 'comfortable' | 'spacious';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export interface GasDesign {
  colors: GasColorPalette;
  typography: GasTypography;
  layout: GasLayout;
}

export interface GasNavigationTab {
  id: string;
  label: string;
  icon: string;
  file: string;
}

export interface GasNavigation {
  tabs: GasNavigationTab[];
  modals: string[];
}

export interface GasBiometric {
  enabled: boolean;
  timeoutMinutes: number;
}

export interface GasAuth {
  google: boolean;
  apple: boolean;
  twitter: boolean;
  linkedin: boolean;
  microsoft: boolean;
  biometric: GasBiometric;
}

export interface GasAnalytics {
  enabled: boolean;
  provider: string;
}

export interface GasDarkMode {
  enabled: boolean;
  default: 'light' | 'dark' | 'system';
}

export interface GasIAPTier {
  name: string;
  productId: string;
  price: string;
  features: string[];
  trialDays?: number;
}

export interface GasIAPOneTimeProduct {
  id: string;
  productId: string;
  name: string;
  description: string;
  price: string;
  type: string;
}

export interface GasCreditPack {
  id: string;
  productId: string;
  credits: number;
  bonusCredits?: number;
  price: string;
}

export interface GasCreditsConfig {
  enabled: boolean;
  currencyName: string;
  currencySymbol: string;
  packs: GasCreditPack[];
}

export interface GasInAppPurchases {
  enabled: boolean;
  tiers: GasIAPTier[];
  oneTimePurchases?: GasIAPOneTimeProduct[];
  credits?: GasCreditsConfig;
}

export interface GasGamification {
  enabled: boolean;
  elements: string[];
}

export interface GasSearch {
  enabled: boolean;
  entities: string[];
}

export interface GasI18n {
  enabled: boolean;
  locales: string[];
  defaultLocale: string;
}

export interface GasOnboarding {
  enabled: boolean;
  steps: string[];
}

export interface GasAds {
  enabled: boolean;
  provider: 'admob';
  bannerAdUnitId?: string;
  interstitialAdUnitId?: string;
}

export interface GasPushNotifications {
  enabled: boolean;
  provider: string;
}

export interface GasCompliance {
  accountDeletionGracePeriod: {
    days: number;
    allowImmediate: boolean;
  };
  dataRetentionDays: number;
}

export interface GasFeatures {
  auth: GasAuth;
  analytics: GasAnalytics;
  darkMode: GasDarkMode;
  inAppPurchases: GasInAppPurchases;
  gamification: GasGamification;
  search: GasSearch;
  i18n: GasI18n;
  onboarding: GasOnboarding;
  ads: GasAds;
  pushNotifications: GasPushNotifications;
  helpSystem: boolean;
  csvExport: boolean;
  compliance: GasCompliance;
}

export interface GasBackendSupabase {
  url: string;
  anonKey: string;
}

export interface GasBackend {
  supabase: GasBackendSupabase;
}

export interface GasLlm {
  provider?: string;
  defaultChatModel?: string;
  defaultEmbedModel?: string;
  defaultTranscribeModel?: string;
  defaultMaxTokens?: number;
  budgetPeriod?: string;
  costScope?: string;
}

export interface GasReleaseChannels {
  storeUrl?: {
    ios?: string;
    android?: string;
  };
  minVersion?: string;
}

export interface GasConfig {
  app: {
    name: string;
    slug: string;
    scheme: string;
    version: string;
    description: string;
  };
  design: GasDesign;
  navigation: GasNavigation;
  features: GasFeatures;
  backend: GasBackend;
  llm: GasLlm;
  releaseChannels?: GasReleaseChannels;
  compliance: GasCompliance;
}
