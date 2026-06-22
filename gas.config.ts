import type { GasConfig } from './lib/gas-config-types';

export const gasConfig = {
  app: {
    name: 'GolfTrip Planner',
    slug: 'golftrip-planner',
    scheme: 'golftrip',
    version: '1.0.0',
    minRuntimeVersion: '1.0.0',
    appStoreUrl: '',
    description: 'Plan, coordinate, and track your golf trips with friends.',
  },

  design: {
    colors: {
      primary: '#2D6A4F',
      primaryDark: '#1B4332',
      secondary: '#52B788',
      accent: '#95D5B2',
      background: '#FFFFFF',
      backgroundDark: '#0D1B14',
      surface: '#F8FAF9',
      surfaceDark: '#1A2E24',
      surfaceElevated: '#F0F5F2',
      text: '#1A2E24',
      textDark: '#E8F5EE',
      textSecondary: '#4A7C63',
      textSecondaryDark: '#8BC4A8',
      textOnPrimary: '#FFFFFF',
      border: '#C8E6D4',
      borderDark: '#2D4F3C',
      success: '#40916C',
      warning: '#F4A261',
      error: '#E63946',
      info: '#4361EE',
    },
    mood: 'calm',
    typography: {
      displayFont: 'PlusJakartaSans',
      bodyFont: 'Inter',
      monoFont: 'SpaceMono',
    },
    layout: {
      cardStyle: 'elevated' as const,
      borderRadius: 'lg' as const,
      spacing: 'comfortable' as const,
    },
  },

  features: {
    analytics: {
      enabled: false,
      crashReporting: false,
      sessionRecording: false,
    },
    inAppPurchases: {
      enabled: false,
      tiers: [
        {
          name: 'Free',
          productId: '',
          price: 0,
          features: ['Up to 2 trips', 'Basic itinerary'],
          trialDays: 0,
        },
        {
          name: 'Pro',
          productId: 'com.golftrip.pro.monthly',
          price: 4.99,
          features: ['Unlimited trips', 'Expense splitting', 'Score tracking', 'Email import'],
          trialDays: 7,
        },
      ],
      oneTimePurchases: [
        {
          id: 'trip_recap_299',
          name: 'Trip Recap',
          productId: 'com.golftrip.recap.once',
          price: 2.99,
          description: 'Shareable recap card for one trip',
          type: 'consumable' as const,
        },
      ],
      credits: {
        enabled: false,
        currencyName: 'credits',
        currencyNamePlural: 'credits',
        packs: [
          {
            id: 'credits_100',
            credits: 100,
            bonusCredits: 0,
            productId: 'com.golftrip.credits.100',
            price: 0.99,
            label: '100 Credits',
          },
          {
            id: 'credits_500',
            credits: 500,
            bonusCredits: 50,
            productId: 'com.golftrip.credits.500',
            price: 3.99,
            label: '500 Credits',
          },
        ],
      },
      marketplace: {
        enabled: false,
        requiresApproval: false,
        commissionPercent: 10,
      },
    },
    auth: {
      google: false,
      apple: false,
      twitter: false,
      linkedin: false,
      microsoft: false,
      mfa: false,
      biometric: {
        enabled: false,
        timeoutMinutes: 15,
      },
    },
    darkMode: {
      enabled: true,
      default: 'system' as const,
    },
    pushNotifications: {
      enabled: true,
      channels: ['general', 'trips', 'reminders'],
    },
    helpSystem: false,
    gamification: {
      enabled: false,
      elements: [],
    },
    search: {
      enabled: false,
      entities: [],
    },
    i18n: {
      enabled: false,
      defaultLocale: 'en',
      locales: ['en'],
    },
    onboarding: {
      enabled: true,
      steps: ['welcome'],
    },
    csvExport: false,
    offlineSync: {
      enabled: false,
      entities: [],
      strategy: 'on_reconnect' as const,
      encrypted: false,
    },
    ads: {
      enabled: false,
      provider: 'admob' as const,
      bannerAdUnitId: '',
      interstitialAdUnitId: '',
    },
    compliance: {
      gdprConsent: false,
      ccpaNotice: false,
      attDialog: false,
    },
    telemetry: {
      enabled: false,
      ingestUrl: '',
      flushIntervalMs: 30000,
      maxQueueSize: 100,
      debugOverlay: false,
    },
    showBuiltWithBadge: false,
  },

  compliance: {
    accountDeletionGracePeriod: {
      days: 30,
    },
    allowImmediateDeletion: false,
    dataRetentionDays: 365,
  },

  multiTenancy: {
    enabled: false,
    defaultRole: 'member' as const,
  },

  navigation: {
    tabs: [
      { id: 'dashboard', label: 'Home', icon: 'Home', file: 'dashboard' },
      { id: 'profile', label: 'Profile', icon: 'User', file: 'profile' },
      { id: 'settings', label: 'Settings', icon: 'Settings', file: 'settings' },
    ],
    modals: [] as string[],
    hiddenScreens: [] as string[],
  },

  backend: {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL as string,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string,
    },
    posthog: {
      apiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '',
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    },
    revenuecat: {
      iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
      androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
    },
    stripe: {
      publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
    },
    telemetry: {
      ingestSecret: process.env.EXPO_PUBLIC_TELEMETRY_SECRET ?? '',
    },
  },

  growth: {
    referralCodeLength: 8,
    experimentsEnabled: true,
    defaultBackgroundSyncInterval: 60_000,
  },

  ui: {
    breakpoints: {
      tablet: 768,
      desktop: 1024,
    },
  },

  media: {
    maxImageEdge: 1920,
    maxUploadBytes: 10 * 1024 * 1024,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    defaultBucket: 'media',
    signedUrlTtlSeconds: 3600,
  },

  search: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  realtime: {
    presenceTimeoutMs: 5000,
  },

  releaseChannels: {
    storeUrl: {
      ios: '',
      android: '',
    },
  },

  integrations: {
    oauthProviders: [] as Array<{ provider: string; scopes: string[] }>,
  },
} as const satisfies GasConfig;
