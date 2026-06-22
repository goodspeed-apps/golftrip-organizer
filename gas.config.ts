import type { GasConfig } from './types/gas-config.d';

export const gasConfig: GasConfig = {
  app: {
    name: 'GolfTrip Pro',
    slug: 'golftrip-pro',
    scheme: 'golftripro',
    version: '1.0.0',
    description: 'Plan, track, and recap your golf trips with friends.',
    icon: './assets/icon.png',
    splash: './assets/splash.png',
    bundleId: {
      ios: 'com.golftrip.pro',
      android: 'com.golftrip.pro',
    },
  },

  design: {
    colors: {
      primary: '#2D6A4F',
      primaryDark: '#1B4332',
      secondary: '#52B788',
      accent: '#95D5B2',
      background: '#F8FAF9',
      backgroundDark: '#0A1612',
      surface: '#FFFFFF',
      surfaceDark: '#132218',
      text: '#1A2E22',
      textDark: '#E8F5EE',
      textSecondary: '#5A7A66',
      textSecondaryDark: '#8AB49A',
      border: '#D8EBE1',
      borderDark: '#2A4A36',
      success: '#2D6A4F',
      warning: '#F4A261',
      error: '#E63946',
    },
    typography: {
      headingWeight: '700',
      fontFamily: 'Inter',
      displayFontFamily: 'PlusJakartaSans',
    },
    layout: {
      spacing: 'comfortable',
      borderRadius: 'lg',
    },
  },

  navigation: {
    tabs: [
      { id: 'dashboard', label: 'Trips', icon: 'map', file: 'dashboard' },
      { id: 'profile', label: 'Profile', icon: 'user', file: 'profile' },
      { id: 'settings', label: 'Settings', icon: 'settings', file: 'settings' },
    ],
    modals: ['create-trip', 'add-tee-time', 'add-expense', 'score-entry', 'trip-recap', 'paywall'],
  },

  features: {
    analytics: {
      enabled: true,
      provider: 'posthog',
    },
    inAppPurchases: {
      enabled: true,
      tiers: [
        {
          name: 'Free',
          productId: 'free',
          price: 'Free',
          features: ['Up to 2 trips', 'Basic itinerary', 'Expense tracking'],
        },
        {
          name: 'Pro',
          productId: 'com.golftrip.pro.monthly',
          price: '$4.99/month',
          features: ['Unlimited trips', 'Trip recap cards', 'CSV export', 'Priority support'],
          highlighted: true,
        },
      ],
      oneTimePurchases: [
        {
          id: 'trip_recap_299',
          productId: 'com.golftrip.pro.tripreap',
          type: 'consumable',
          name: 'Trip Recap',
          description: 'Unlock shareable trip recap card',
          price: '$2.99',
        },
      ],
      credits: {
        enabled: false,
        packs: [
          {
            id: 'credits_100',
            productId: 'com.golftrip.pro.credits100',
            credits: 100,
            price: '$0.99',
            name: '100 Credits',
          },
        ],
      },
    },
    darkMode: {
      enabled: true,
      default: 'system',
    },
    gamification: {
      enabled: false,
      elements: [],
    },
    search: {
      enabled: true,
      entities: ['trips', 'courses'],
    },
    i18n: {
      enabled: false,
      locales: ['en'],
      defaultLocale: 'en',
    },
    onboarding: {
      enabled: true,
      steps: ['welcome'],
    },
    auth: {
      email: true,
      google: false,
      apple: false,
      twitter: false,
      linkedin: false,
      microsoft: false,
      biometric: {
        enabled: true,
        timeoutMinutes: 5,
      },
    },
    ads: {
      enabled: false,
      provider: 'admob',
    },
    helpSystem: true,
    csvExport: true,
    pushNotifications: {
      enabled: false,
    },
    marketplace: {
      enabled: false,
      platformFeePercent: 10,
      listingCategories: ['golf-courses', 'equipment'],
      sellerPayoutMethod: 'stripe',
    },
    showBuiltWithBadge: false,
  },

  backend: {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },

  compliance: {
    gdprConsent: true,
    ccpaNotice: true,
    accountDeletionGracePeriod: {
      days: 30,
      allowImmediate: false,
    },
  },

  legal: {
    privacyPolicyUrl: 'https://example.com/privacy',
    termsOfServiceUrl: 'https://example.com/terms',
  },

  llm: {
    provider: 'openai',
    defaultChatModel: 'gpt-4o-mini',
    defaultEmbedModel: 'text-embedding-3-small',
    defaultTranscribeModel: 'whisper-1',
    defaultMaxTokens: 1024,
    budgetPeriod: 'day',
    costScope: 'llm',
  },

  releaseChannels: {
    storeUrl: {
      ios: 'https://apps.apple.com/app/id000000000',
      android: 'https://play.google.com/store/apps/details?id=com.golftrip.pro',
    },
  },
};
