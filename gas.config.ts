import type {
  GasConfig,
  IAPTier,
  IAPOneTimePurchase,
  CreditsConfig,
} from './lib/gas-config-types';

export const gasConfig = {
  app: {
    name: 'GolfTrip Planner',
    slug: 'golftrip-planner',
    scheme: 'golftrip',
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
      background: '#F8FAF9',
      backgroundDark: '#0A0F0D',
      surface: '#FFFFFF',
      surfaceDark: '#1A2420',
      text: '#1A2420',
      textDark: '#F0F7F4',
      textSecondary: '#4A6B5C',
      textSecondaryDark: '#8FAF9F',
      border: '#D8EEE3',
      borderDark: '#2D4A3E',
      success: '#52B788',
      warning: '#F4A261',
      error: '#E63946',
    },
    mood: 'calm',
    typography: {
      displayFont: 'Outfit',
      bodyFont: 'Manrope',
      monoFont: 'SpaceMono',
    },
    layout: {
      cardStyle: 'elevated' as const,
      borderRadius: 'xl' as const,
      spacing: 'comfortable' as const,
    },
  },

  features: {
    analytics: {
      enabled: true,
      provider: 'posthog',
      sessionRecording: false,
      crashReporting: true,
    },
    inAppPurchases: {
      enabled: true,
      tiers: [
        {
          name: 'Free',
          productId: '',
          price: 'Free',
          features: ['Up to 2 trips', 'Basic itinerary'],
          trialDays: 0,
        },
        {
          name: 'Pro',
          productId: 'com.golftrip.pro.monthly',
          price: '$4.99/mo',
          features: ['Unlimited trips', 'Expense tracking', 'Score history', 'Trip recap'],
          trialDays: 7,
        },
      ] as IAPTier[],
      oneTimePurchases: [
        {
          productId: 'com.golftrip.recap.unlock',
          name: 'Trip Recap Unlock',
          description: 'Unlock shareable trip recap card',
          price: '$2.99',
          type: 'consumable',
        },
      ] as IAPOneTimePurchase[],
      credits: {
        enabled: false,
        currencyName: 'credit',
        currencyNamePlural: 'credits',
        icon: '⭐',
        packages: [],
      } as CreditsConfig,
      marketplace: {
        enabled: false,
        requiresApproval: false,
        commissionPercent: 10,
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
    gamification: {
      enabled: false,
      elements: [] as string[],
    },
    search: {
      enabled: false,
      entities: [] as string[],
    },
    i18n: {
      enabled: false,
      locales: ['en'],
      defaultLocale: 'en',
    },
    onboarding: {
      enabled: false,
      steps: [] as string[],
    },
    helpSystem: false,
    ads: {
      enabled: false,
      provider: 'admob' as const,
    },
    csvExport: false,
    offlineSync: {
      enabled: false,
      entities: [] as string[],
      strategy: 'on_reconnect' as const,
      encrypted: false,
    },
    compliance: {
      gdprConsent: false,
      ccpaNotice: false,
      attDialog: true,
      accountDeletionGracePeriod: {
        days: 30,
      },
    },
    auth: {
      google: false,
      apple: true,
      twitter: false,
      linkedin: false,
      microsoft: false,
      biometric: {
        enabled: false,
        timeoutMinutes: 15,
      },
      mfa: false,
      anonymousAuth: {
        enabled: false,
        tables: [] as string[],
      },
    },
    telemetry: {
      enabled: false,
      debugOverlay: false,
      ingestUrl: '',
      flushIntervalMs: 30000,
      maxQueueSize: 100,
    },
    showBuiltWithBadge: false,
  },

  compliance: {
    accountDeletionGracePeriod: {
      days: 30,
    },
    immediateDeleteAllowed: false,
  },

  navigation: {
    tabs: [
      {
        id: 'dashboard',
        label: 'Trips',
        icon: 'Home',
        file: 'dashboard',
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: 'User',
        file: 'profile',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: 'Settings',
        file: 'settings',
      },
    ],
    modals: [] as string[],
    hiddenScreens: [] as string[],
  },

  backend: {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    posthog: {
      apiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '',
      host: 'https://app.posthog.com',
    },
    revenuecat: {
      iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
      androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
    },
    sentry: {
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
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
    defaultBackgroundSyncInterval: 60_000,
  },

  releaseChannels: {
    storeUrl: {
      ios: '',
      android: '',
    },
  },

  integrations: {
    oauthProviders: [] as Array<{ provider: string }>,
  },

  media: {
    defaultBucket: 'uploads',
    maxImageEdge: 2048,
    maxUploadBytes: 10 * 1024 * 1024,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    signedUrlTtlSeconds: 3600,
  },

  search: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  realtime: {
    presenceTimeoutMs: 5000,
  },

  ui: {
    breakpoints: {
      tablet: 768,
      desktop: 1200,
    },
  },
} as const satisfies Record<string, unknown>;

export type AppConfig = typeof gasConfig;
