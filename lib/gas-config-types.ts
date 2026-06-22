export interface IAPTier {
  name: string;
  productId: string;
  price: string;
  features?: string[];
  trialDays?: number;
}

export interface IAPOneTimePurchase {
  productId: string;
  name: string;
  description?: string;
  price: string;
  type?: 'consumable' | 'non_consumable';
}

export interface CreditsConfig {
  enabled: boolean;
  currencyName: string;
  currencyNamePlural: string;
  icon?: string;
  packages?: Array<{
    productId: string;
    credits: number;
    price: string;
    bonus?: number;
  }>;
}

export interface GasConfig {
  app: {
    name: string;
    slug: string;
    scheme: string;
    version: string;
    minRuntimeVersion: string;
    appStoreUrl?: string;
  };
  design: {
    colors: Record<string, string>;
    mood: string;
    typography: {
      displayFont?: string;
      bodyFont?: string;
      monoFont?: string;
    };
    layout: {
      cardStyle: 'flat' | 'elevated' | 'outlined' | 'filled';
      borderRadius: string;
      spacing: string;
    };
  };
  features: {
    analytics: {
      enabled: boolean;
      provider?: string;
      sessionRecording?: boolean;
      crashReporting?: boolean;
    };
    inAppPurchases: {
      enabled: boolean;
      tiers: IAPTier[];
      oneTimePurchases?: IAPOneTimePurchase[];
      credits?: CreditsConfig;
      marketplace?: {
        enabled: boolean;
        requiresApproval?: boolean;
        commissionPercent?: number;
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
      locales: string[];
      defaultLocale: string;
    };
    onboarding: {
      enabled: boolean;
      steps: string[];
    };
    helpSystem: boolean;
    ads: {
      enabled: boolean;
      provider?: string;
    };
    csvExport: boolean;
    offlineSync?: {
      enabled: boolean;
      entities?: string[];
      strategy?: string;
      encrypted?: boolean;
    };
    compliance: {
      gdprConsent: boolean;
      ccpaNotice: boolean;
      attDialog: boolean;
      accountDeletionGracePeriod?: {
        days: number;
      };
    };
    auth: {
      google?: boolean;
      apple?: boolean;
      twitter?: boolean;
      linkedin?: boolean;
      microsoft?: boolean;
      biometric: {
        enabled: boolean;
        timeoutMinutes: number;
      };
      mfa?: boolean;
      anonymousAuth?: {
        enabled: boolean;
        tables: string[];
      };
    };
    telemetry?: {
      enabled: boolean;
      debugOverlay?: boolean;
      ingestUrl?: string;
      flushIntervalMs?: number;
      maxQueueSize?: number;
    };
    showBuiltWithBadge?: boolean;
  };
  compliance: {
    accountDeletionGracePeriod: {
      days: number;
    };
    immediateDeleteAllowed?: boolean;
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
    posthog: {
      apiKey: string;
      host: string;
    };
    revenuecat: {
      iosKey: string;
      androidKey: string;
    };
    sentry?: {
      dsn: string;
    };
    telemetry?: {
      ingestSecret: string;
    };
    stripe?: {
      publishableKey: string;
    };
  };
  multiTenancy: {
    enabled: boolean;
    defaultRole?: string;
  };
  growth: {
    referralCodeLength: number;
    experimentsEnabled: boolean;
    defaultBackgroundSyncInterval: number;
  };
  releaseChannels?: {
    storeUrl?: {
      ios?: string;
      android?: string;
    };
  };
  integrations: {
    oauthProviders: Array<{ provider: string }>;
  };
  media: {
    defaultBucket: string;
    maxImageEdge: number;
    maxUploadBytes: number;
    allowedContentTypes: string[];
    signedUrlTtlSeconds: number;
  };
  search: {
    defaultLimit: number;
    maxLimit: number;
  };
  realtime?: {
    presenceTimeoutMs?: number;
  };
  ui: {
    breakpoints: {
      tablet: number;
      desktop: number;
    };
  };
}
