import type { GasConfig } from './types/gas-config';

export const gasConfig: GasConfig = {
  app: {
    name: 'GolfTripPlanner',
    slug: 'golf-trip-planner',
    scheme: 'golftripplanner',
    version: '1.0.0',
    minRuntimeVersion: '1.0.0',
    appStoreUrl: '',
  },
  design: {
    colors: {
      primary: '#2D6A4F',
      primaryDark: '#1B4332',
      secondary: '#52B788',
      accent: '#95D5B2',
      background: '#FFFFFF',
      backgroundDark: '#1A1A2E',
      surface: '#F8F9FA',
      surfaceDark: '#16213E',
      text: '#212529',
      textDark: '#F8F9FA',
      textSecondary: '#6C757D',
      textSecondaryDark: '#ADB5BD',
      border: '#DEE2E6',
      borderDark: '#343A40',
      success: '#40916C',
      warning: '#F4A261',
      error: '#E63946',
    },
    typography: {
      displayFont: 'PlusJakartaSans',
      bodyFont: 'Inter',
      monoFont: 'system',
    },
    layout: {
      cardStyle: 'elevated',
      borderRadius: 'lg',
      spacing: 'comfortable',
    },
    mood: 'calm',
  },
  navigation: {
    tabs: [
      { id: 'dashboard', label: 'Home', icon: 'Home', file: 'dashboard' },
      { id: 'profile', label: 'Profile', icon: 'User', file: 'profile' },
      { id: 'settings', label: 'Settings', icon: 'Settings', file: 'settings' },
    ],
    modals: ['paywall', 'create-trip', 'add-tee-time', 'email-import', 'score-entry', 'trip-recap'],
    hiddenScreens: [],
  },
  features: {
    analytics: {
      enabled: true,
      crashReporting: true,
      sessionRecording: false,
    },
    auth: {
      google: false,
      apple: false,
      twitter: false,
      linkedin: false,
      microsoft: false,
      biometric: {
        enabled: true,
        timeoutMinutes: 15,
      },
      mfa: false,
    },
    inAppPurchases: {
      enabled: true,
      tiers: [
        {
          name: 'Free',
          productId: '',
          price: 0,
          features: ['Up to 3 trips', 'Basic itinerary'],
          trialDays: 0,
        },
        {
          name: 'Pro',
          productId: 'com.golftripplanner.pro_monthly',
          price: 4.99,
          features: ['Unlimited trips', 'Expense tracking', 'Score history', 'Trip recap', 'CSV export'],
          trialDays: 7,
        },
      ],
      oneTimePurchases: [
        {
          name: 'Trip Recap',
          productId: 'trip_recap_299',
          price: 2.99,
          description: 'Unlock shareable trip recap card',
        },
      ],
      credits: {
        enabled: false,
        currencyName: 'credit',
        currencyNamePlural: 'credits',
        currencyIcon: '⛳',
        packs: [],
      },
      marketplace: {
        enabled: false,
        requiresApproval: false,
      },
    },
    gamification: {
      enabled: false,
      elements: [],
    },
    darkMode: {
      enabled: true,
      default: 'system',
    },
    pushNotifications: {
      enabled: true,
      channels: ['general', 'trips', 'reminders'],
    },
    helpSystem: true,
    search: {
      enabled: false,
      entities: [],
    },
    i18n: {
      enabled: false,
      locales: ['en'],
      defaultLocale: 'en',
    },
    onboarding: {
      enabled: false,
      steps: [],
    },
    csvExport: true,
    ads: {
      enabled: false,
      provider: 'admob',
    },
    compliance: {
      gdprConsent: true,
      ccpaNotice: false,
      attDialog: true,
      accountDeletionGracePeriod: {
        days: 30,
      },
      allowImmediateDeletion: false,
    },
    offlineSync: {
      enabled: true,
      entities: ['trips', 'tee_times'],
      strategy: 'on_reconnect',
    },
    telemetry: {
      enabled: false,
      ingestUrl: '',
      flushIntervalMs: 30000,
      maxQueueSize: 100,
      debugOverlay: false,
    },
    showBuiltWithBadge: false,
    anonymousAuth: {
      enabled: false,
      tables: [],
    },
  },
  compliance: {
    accountDeletionGracePeriod: {
      days: 30,
    },
    allowImmediateDeletion: false,
    gdprConsent: true,
    ccpaNotice: false,
    attDialog: true,
  },
  backend: {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    revenuecat: {
      iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
      androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
    },
    posthog: {
      apiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '',
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    },
    telemetry: {
      ingestSecret: process.env.EXPO_PUBLIC_TELEMETRY_SECRET ?? '',
    },
    stripe: {
      publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
    },
  },
  multiTenancy: {
    enabled: false,
    defaultRole: 'member',
  },
  growth: {
    referralCodeLength: 8,
    experimentsEnabled: false,
    defaultBackgroundSyncInterval: 60000,
  },
  ui: {
    breakpoints: {
      tablet: 768,
      desktop: 1024,
    },
  },
  realtime: {
    presenceTimeoutMs: 5000,
  },
  media: {
    maxImageEdge: 1920,
    maxUploadBytes: 10485760,
    defaultBucket: 'media',
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    signedUrlTtlSeconds: 3600,
  },
  search: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  integrations: {
    oauthProviders: [],
  },
};
