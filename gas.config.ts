import type { GasConfig } from './types/gas-config.d';

export const gasConfig: GasConfig = {
  app: {
    name: 'GolfTrip Planner',
    slug: 'golftrip-planner',
    scheme: 'golftripplanner',
    version: '1.0.0',
    description: 'Plan and manage golf trips with your crew',
  },
  design: {
    colors: {
      primary: '#2D6A4F',
      primaryDark: '#1B4332',
      secondary: '#74C69D',
      accent: '#52B788',
      background: '#FFFFFF',
      backgroundDark: '#0D1B2A',
      surface: '#F8F9FA',
      surfaceDark: '#1A2E3B',
      text: '#1A1A2E',
      textDark: '#F0F4F8',
      textSecondary: '#6C757D',
      textSecondaryDark: '#A0ADB8',
      border: '#DEE2E6',
      borderDark: '#2D3E50',
      success: '#40C057',
      warning: '#FD7E14',
      error: '#FA5252',
    },
    typography: {
      headingFont: 'PlusJakartaSans_700Bold',
      bodyFont: 'Inter_400Regular',
      headingWeight: '700',
      scale: 'comfortable',
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
    modals: ['create-trip', 'add-tee-time', 'add-expense', 'score-entry', 'paywall', 'email-import', 'trip-recap'],
  },
  features: {
    auth: {
      google: true,
      apple: true,
      twitter: false,
      linkedin: false,
      microsoft: false,
      biometric: {
        enabled: true,
        timeoutMinutes: 15,
      },
    },
    analytics: {
      enabled: true,
      provider: 'posthog',
    },
    darkMode: {
      enabled: true,
      default: 'system',
    },
    inAppPurchases: {
      enabled: true,
      tiers: [
        {
          name: 'Free',
          productId: '',
          price: 'Free',
          features: ['Up to 2 trips', 'Basic itinerary', 'Score tracking'],
        },
        {
          name: 'Pro',
          productId: 'com.golftripplanner.pro_monthly',
          price: '$4.99/month',
          features: ['Unlimited trips', 'Expense splitting', 'Trip recap', 'Email import', 'CSV export', 'Priority support'],
          trialDays: 7,
        },
      ],
      oneTimePurchases: [
        {
          id: 'trip_recap_299',
          productId: 'com.golftripplanner.trip_recap',
          name: 'Trip Recap',
          description: 'Unlock a shareable recap card for your trip',
          price: '$2.99',
          type: 'unlock',
        },
      ],
      credits: {
        enabled: false,
        currencyName: 'credits',
        currencySymbol: '⭐',
        packs: [
          {
            id: 'credits_100',
            productId: 'com.golftripplanner.credits_100',
            credits: 100,
            price: '$0.99',
          },
          {
            id: 'credits_500',
            productId: 'com.golftripplanner.credits_500',
            credits: 500,
            bonusCredits: 50,
            price: '$3.99',
          },
        ],
      },
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
      steps: ['welcome', 'create-trip', 'invite-friends'],
    },
    ads: {
      enabled: false,
      provider: 'admob',
    },
    pushNotifications: {
      enabled: true,
      provider: 'expo',
    },
    helpSystem: true,
    csvExport: true,
    compliance: {
      accountDeletionGracePeriod: {
        days: 30,
        allowImmediate: false,
      },
      dataRetentionDays: 365,
    },
  },
  backend: {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
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
      ios: '',
      android: '',
    },
  },
  compliance: {
    accountDeletionGracePeriod: {
      days: 30,
      allowImmediate: false,
    },
    dataRetentionDays: 365,
  },
};
