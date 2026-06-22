/**
 * GAS Config Type Definitions
 *
 * Defines the shape of gasConfig used throughout the app.
 * This file is the single source of truth for the config structure.
 */

export interface GasColorPalette {
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  background: string;
  backgroundDark: string;
  surface: string;
  surfaceDark: string;
  surfaceElevated?: string;
  text: string;
  textDark: string;
  textSecondary: string;
  textSecondaryDark: string;
  textOnPrimary: string;
  border: string;
  borderDark: string;
  success: string;
  warning: string;
  error: string;
  info?: string;
  [key: string]: string | undefined;
}

export interface GasConfig {
  app: {
    name: string;
    slug: string;
    scheme: string;
    version: string;
    minRuntimeVersion: string;
    appStoreUrl: string;
    description?: string;
  };

  design: {
    colors: GasColorPalette;
    mood: string;
    typography: {
      displayFont: string;
      bodyFont: string;
      monoFont: string;
    };
    layout: {
      cardStyle: 'flat' | 'elevated' | 'outlined' | 'filled';
      borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
      spacing: 'compact' | 'comfortable' | 'spacious';
    };
  };

  features: {
    analytics: {
      enabled: boolean;
      crashReporting?: boolean;
      sessionRecording?: boolean;
      provider?: string;
    };
    inAppPurchases: {
      enabled: boolean;
      tiers: Array<{
        name: string;
        productId: string;
        price: number;
        features: string[];
        trialDays?: number;
      }>;
      oneTimePurchases?: Array<{
        id: string;
        name: string;
        productId: string;
        price: number;
        description: string;
        type?: string;
      }>;
      credits?: {
        enabled: boolean;
        currencyName: string;
        currencyNamePlural: string;
        packs: Array<{
          id: string;
          credits: number;
          bonusCredits?: number;
          productId: string;
          price: number;
          label: string;
        }>;
      };
      marketplace?: {
        enabled: boolean;
        requiresApproval?: boolean;
        commissionPercent?: number;
      };
    };
    auth: {
      google: boolean;
      apple: boolean;
      twitter: boolean;
      linkedin?: boolean;
      microsoft?: boolean;
      mfa?: boolean;
      biometric: {
        enabled: boolean;
        timeoutMinutes: number;
      };
    };
    darkMode: {
      enabled: boolean;
      default?: 'light' | 'dark' | 'system';
    };
    pushNotifications: {
      enabled: boolean;
      channels: string[];
    };
    helpSystem: boolean;
    gamification: {
      enabled: boolean;
      elements: string[];
    };
    search: {
      enabled: boolean;
      entities: string[];
    };
    i18n: {
      enabled: boolean;
      defaultLocale: string;
      locales: string[];
    };
    onboarding: {
      enabled: boolean;
      steps: string[];
    };
    csvExport?: boolean;
    offlineSync?: {
      enabled: boolean;
      entities: string[];
      strategy: 'on_reconnect' | 'periodic';
      encrypted?: boolean;
    };
    ads?: {
      enabled: boolean;
      provider: 'admob' | 'facebook';
      bannerAdUnitId?: string;
      interstitialAdUnitId?: string;
    };
    compliance: {
      gdprConsent: boolean;
      ccpaNotice: boolean;
      attDialog: boolean;
    };
    telemetry?: {
      enabled: boolean;
      ingestUrl: string;
      flushIntervalMs: number;
      maxQueueSize: number;
      debugOverlay?: boolean;
    };
    showBuiltWithBadge?: boolean;
  };

  compliance: {
    accountDeletionGracePeriod: {
      days: number;
    };
    allowImmediateDeletion: boolean;
    dataRetentionDays?: number;
  };

  multiTenancy: {
    enabled: boolean;
    defaultRole?: string;
  };

  navigation: {
    tabs: Array<{
      id: string;
      label: string;
      icon: string;
      file: string;
    }>;
    modals: string[];
    hiddenScreens: string[];
  };

  backend: {
    supabase: {
      url: string;
      anonKey: string;
    };
    posthog?: {
      apiKey: string;
      host: string;
    };
    revenuecat?: {
      iosKey: string;
      androidKey: string;
    };
    stripe?: {
      publishableKey: string;
    };
    telemetry?: {
      ingestSecret: string;
    };
  };

  growth?: {
    referralCodeLength?: number;
    experimentsEnabled?: boolean;
    defaultBackgroundSyncInterval?: number;
  };

  ui?: {
    breakpoints?: {
      tablet: number;
      desktop: number;
    };
  };

  media?: {
    maxImageEdge: number;
    maxUploadBytes: number;
    allowedContentTypes: string[];
    defaultBucket: string;
    signedUrlTtlSeconds: number;
  };

  search?: {
    defaultLimit: number;
    maxLimit: number;
  };

  realtime?: {
    presenceTimeoutMs?: number;
  };

  releaseChannels?: {
    storeUrl?: {
      ios?: string;
      android?: string;
    };
  };

  integrations?: {
    oauthProviders: Array<{ provider: string; scopes: string[] }>;
  };
}
