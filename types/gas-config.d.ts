export interface GasAppConfig {
  name: string;
  slug: string;
  scheme: string;
  version: string;
  minRuntimeVersion: string;
  appStoreUrl?: string;
}

export interface GasColors {
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
  displayFont?: string;
  bodyFont?: string;
  monoFont?: string;
}

export interface GasLayout {
  cardStyle: 'flat' | 'elevated' | 'outlined' | 'filled';
  borderRadius: string;
  spacing: string;
}

export interface GasDesignConfig {
  colors: GasColors;
  typography: GasTypography;
  layout: GasLayout;
  mood: string;
}

export interface GasTabConfig {
  id: string;
  label: string;
  icon: string;
  file: string;
}

export interface GasNavigationConfig {
  tabs: GasTabConfig[];
  modals: string[];
  hiddenScreens: string[];
}

export interface GasAnalyticsConfig {
  enabled: boolean;
  crashReporting: boolean;
  sessionRecording?: boolean;
}

export interface GasBiometricConfig {
  enabled: boolean;
  timeoutMinutes: number;
}

export interface GasAuthConfig {
  google: boolean;
  apple: boolean;
  twitter: boolean;
  linkedin: boolean;
  microsoft: boolean;
  biometric: GasBiometricConfig;
  mfa?: boolean;
}

export interface GasTierConfig {
  name: string;
  productId: string;
  price: number;
  features: string[];
  trialDays?: number;
}

export interface GasOneTimePurchase {
  name: string;
  productId: string;
  price: number;
  description?: string;
}

export interface GasCreditPack {
  id?: string;
  name?: string;
  amount: number;
  price: number;
  productId?: string;
  popular?: boolean;
  bonus?: number;
}

export interface GasCreditsConfig {
  enabled: boolean;
  currencyName: string;
  currencyNamePlural: string;
  currencyIcon?: string;
  packs: GasCreditPack[];
}

export interface GasMarketplaceConfig {
  enabled: boolean;
  requiresApproval?: boolean;
}

export interface GasInAppPurchases {
  enabled: boolean;
  tiers: GasTierConfig[];
  oneTimePurchases?: GasOneTimePurchase[];
  credits?: GasCreditsConfig;
  marketplace?: GasMarketplaceConfig;
}

export interface GasGamificationConfig {
  enabled: boolean;
  elements: string[];
}

export interface GasDarkModeConfig {
  enabled: boolean;
  default: 'dark' | 'light' | 'system';
}

export interface GasPushNotificationsConfig {
  enabled: boolean;
  channels: string[];
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

export interface GasAdsConfig {
  enabled: boolean;
  provider: string;
}

export interface GasAccountDeletionGracePeriod {
  days: number;
}

export interface GasCompliance {
  gdprConsent: boolean;
  ccpaNotice: boolean;
  attDialog: boolean;
  accountDeletionGracePeriod: GasAccountDeletionGracePeriod;
  allowImmediateDeletion: boolean;
}

export interface GasOfflineSyncConfig {
  enabled: boolean;
  entities: string[];
  strategy: string;
  encrypted?: boolean;
}

export interface GasTelemetryConfig {
  enabled: boolean;
  ingestUrl: string;
  flushIntervalMs: number;
  maxQueueSize: number;
  debugOverlay?: boolean;
}

export interface GasAnonymousAuthConfig {
  enabled: boolean;
  tables: string[];
}

export interface GasFeaturesConfig {
  analytics: GasAnalyticsConfig;
  auth: GasAuthConfig;
  inAppPurchases: GasInAppPurchases;
  gamification: GasGamificationConfig;
  darkMode: GasDarkModeConfig;
  pushNotifications: GasPushNotificationsConfig;
  helpSystem: boolean;
  search: GasSearchConfig;
  i18n: GasI18nConfig;
  onboarding: GasOnboardingConfig;
  csvExport?: boolean;
  ads: GasAdsConfig;
  compliance: GasCompliance;
  offlineSync?: GasOfflineSyncConfig;
  telemetry?: GasTelemetryConfig;
  showBuiltWithBadge?: boolean;
  anonymousAuth?: GasAnonymousAuthConfig;
}

export interface GasSupabaseConfig {
  url: string;
  anonKey: string;
}

export interface GasRevenueCatConfig {
  iosKey: string;
  androidKey: string;
}

export interface GasPostHogConfig {
  apiKey: string;
  host: string;
}

export interface GasTelemetryBackendConfig {
  ingestSecret: string;
}

export interface GasStripeConfig {
  publishableKey: string;
}

export interface GasBackend {
  supabase: GasSupabaseConfig;
  revenuecat: GasRevenueCatConfig;
  posthog: GasPostHogConfig;
  telemetry: GasTelemetryBackendConfig;
  stripe?: GasStripeConfig;
}

export interface GasMultiTenancyConfig {
  enabled: boolean;
  defaultRole: string;
}

export interface GasGrowthConfig {
  referralCodeLength: number;
  experimentsEnabled: boolean;
  defaultBackgroundSyncInterval: number;
}

export interface GasUiConfig {
  breakpoints: {
    tablet: number;
    desktop: number;
  };
}

export interface GasRealtimeConfig {
  presenceTimeoutMs: number;
}

export interface GasMediaConfig {
  maxImageEdge: number;
  maxUploadBytes: number;
  defaultBucket: string;
  allowedContentTypes: string[];
  signedUrlTtlSeconds: number;
}

export interface GasSearchServiceConfig {
  defaultLimit: number;
  maxLimit: number;
}

export interface GasOAuthProviderConfig {
  provider: string;
  scopes?: string[];
}

export interface GasIntegrationsConfig {
  oauthProviders: GasOAuthProviderConfig[];
}

export interface GasConfig {
  app: GasAppConfig;
  design: GasDesignConfig;
  navigation: GasNavigationConfig;
  features: GasFeaturesConfig;
  compliance: GasCompliance;
  backend: GasBackend;
  multiTenancy: GasMultiTenancyConfig;
  growth: GasGrowthConfig;
  ui: GasUiConfig;
  realtime?: GasRealtimeConfig;
  media: GasMediaConfig;
  search: GasSearchServiceConfig;
  integrations: GasIntegrationsConfig;
}
