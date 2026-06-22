import type { GASConfig } from './lib/gas-config-types';

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
      background: '#F8F9FA',
      backgroundDark: '#1A1A2E',
      surface: '#FFFFFF',
      surfaceDark: '#16213E',
      text: '#1A1A2E',
      textDark: '#E8E8F0',
      textSecondary: '#6C757D',
      textSecondaryDark: '#9999AA',
      border: '#DEE2E6',
      borderDark: '#2A2A4A',
      success: '#40916C',
      warning: '#F4A261',
      error: '#E63946',
    },
    typography: {
      displayFont: 'PlusJakartaSans',
      bodyFont: 'Inter',
      monoFont: 'system',
      headingWeight: '700' as const,
    },
  },
  navigation: {
    tabs: [
      { id: 'dashboard', label: 'Trips', icon: 'map', file: 'dashboard' },
      { id: 'profile', label: 'Profile', icon: 'user', file: 'profile' },
      { id: 'settings', label: 'Settings', icon: 'settings', file: 'settings' },
    ],
    modals: ['paywall', 'create-trip', 'add-tee-time', 'email-import', 'score-entry', 'trip-recap', 'add-expense', 'settlements'],
  },
  features: {
    analytics: { enabled: false as const },
    inAppPurchases: {
      enabled: false as const,
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
          features: ['Unlimited trips', 'Email import', 'Trip recap', 'CSV export'],
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
        },
      ],
      credits: {
        enabled: false as const,
        currencyName: 'credits',
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
            label: '500 Credits + 50 Bonus',
          },
        ],
      },
    },
    darkMode: { enabled: true as const },
    gamification: {
      enabled: false as const,
      elements: [] as string[],
    },
    search: {
      enabled: false as const,
      entities: [] as string[],
    },
    i18n: {
      enabled: false as const,
      locales: ['en'],
      defaultLocale: 'en',
    },
    onboarding: {
      enabled: true as const,
      steps: ['welcome'],
    },
    auth: {
      google: false as const,
      apple: false as const,
      twitter: false as const,
      linkedin: false as const,
      microsoft: false as const,
      biometric: {
        enabled: false as const,
        timeoutMinutes: 5,
      },
      mfa: false as const,
    },
    pushNotifications: {
      enabled: false as const,
    },
    helpSystem: false as const,
    csvExport: false as const,
    ads: {
      enabled: false as const,
      provider: 'admob' as const,
    },
    telemetry: {
      enabled: false as const,
      debugOverlay: false as const,
    },
    marketplace: {
      enabled: false as const,
      requiresApproval: false as const,
      commissionPercent: 10,
      platformFeePercent: 0,
      listingCategories: [] as string[],
      sellerPayoutMethod: 'stripe' as const,
    },
    anonymousAuth: {
      enabled: false as const,
      tables: [] as string[],
    },
  },
  compliance: {
    accountDeletionGracePeriod: {
      days: 30,
    },
    immediateDeleteAllowed: false as const,
    allowImmediateDeletion: false as const,
  },
  backend: {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
  media: {
    maxImageEdge: 1200,
    maxUploadBytes: 5 * 1024 * 1024,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    defaultBucket: 'media',
    signedUrlTtlSeconds: 3600,
  },
  llm: {
    provider: 'openai' as const,
    defaultChatModel: 'gpt-4o-mini',
    defaultEmbedModel: 'text-embedding-3-small',
    defaultTranscribeModel: 'whisper-1',
    defaultMaxTokens: 1024,
    budgetPeriod: 'day' as const,
    costScope: 'llm',
  },
} as const satisfies GASConfig;
