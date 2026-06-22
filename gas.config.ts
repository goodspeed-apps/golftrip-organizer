/**
 * GAS Template — Application Configuration
 *
 * Single source of truth for the generated app. The DevAgent reads this file
 * to generate screens, navigation, and feature modules.
 */

// ─── Type definitions ─────────────────────────────────────────────────────────

export interface IAPTier {
  id: string;
  name: string;
  productId: string;
  description: string;
  type: 'subscription' | 'one_time';
  price?: string;
  features?: string[];
  trialDays?: number;
  credits?: number;
}

export interface IAPCreditPack {
  id: string;
  productId: string;
  credits: number;
  price?: string;
  bonusCredits?: number;
}

export interface IAPOneTimePurchase {
  id: string;
  productId: string;
  name: string;
  description: string;
  price?: string;
}

export interface CreditsConfig {
  enabled: boolean;
  currencyName: string;
  packs: IAPCreditPack[];
}

export interface GasConfig {
  app: {
    name: string;
    slug: string;
    scheme: string;
    version: string;
    description: string;
  };
  design: {
    colors: {
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
    };
    typography: {
      headingWeight: '700' | '800' | '900';
      fontFamily?: string;
    };
    layout: {
      spacing: 'compact' | 'comfortable' | 'spacious';
      borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    };
  };
  navigation: {
    tabs: Array<{
      id: string;
      label: string;
      icon: string;
      file: string;
    }>;
    modals: string[];
  };
  features: {
    analytics: { enabled: boolean; provider?: string };
    inAppPurchases: {
      enabled: boolean;
      tiers: IAPTier[];
      oneTimePurchases?: IAPOneTimePurchase[];
      credits?: CreditsConfig;
    };
    darkMode: { enabled: boolean; default?: 'light' | 'dark' | 'system' };
    helpSystem: boolean;
    csvExport?: boolean;
    ads: { enabled: boolean; provider: 'admob' };
    gamification: { enabled: boolean; elements: string[] };
    search: { enabled: boolean; entities: string[] };
    i18n: { enabled: boolean; locales: string[]; defaultLocale: string };
    onboarding: { enabled: boolean; steps: string[] };
    pushNotifications: { enabled: boolean };
    auth: {
      google: boolean;
      apple: boolean;
      twitter: boolean;
      linkedin: boolean;
      microsoft: boolean;
      biometric: { enabled: boolean; timeoutMinutes: number };
    };
  };
  backend: {
    supabase: {
      url: string;
      anonKey: string;
    };
  };
  compliance: {
    accountDeletionGracePeriod: { days: number };
    allowImmediateDeletion?: boolean;
  };
  llm: {
    provider?: string;
    defaultChatModel?: string;
    defaultEmbedModel?: string;
    defaultTranscribeModel?: string;
    defaultMaxTokens?: number;
    budgetPeriod?: string;
    costScope?: string;
  };
}

// ─── Configuration ─────────────────────────────────────────────────────────────

export const gasConfig: GasConfig = {
  app: {
    name: 'GASTemplate',
    slug: 'gas-template',
    scheme: 'gastemplate',
    version: '1.0.0',
    description: 'GAS Template application',
  },
  design: {
    colors: {
      primary: '#2563EB',
      primaryDark: '#1D4ED8',
      secondary: '#64748B',
      accent: '#F59E0B',
      background: '#FFFFFF',
      backgroundDark: '#0F172A',
      surface: '#F8FAFC',
      surfaceDark: '#1E293B',
      text: '#0F172A',
      textDark: '#F8FAFC',
      textSecondary: '#64748B',
      textSecondaryDark: '#94A3B8',
      border: '#E2E8F0',
      borderDark: '#334155',
      success: '#22C55E',
      warning: '#F59E0B',
      error: '#EF4444',
    },
    typography: {
      headingWeight: '700',
    },
    layout: {
      spacing: 'comfortable',
      borderRadius: 'lg',
    },
  },
  navigation: {
    tabs: [
      { id: 'dashboard', label: 'Dashboard', icon: 'home', file: 'dashboard' },
      { id: 'profile', label: 'Profile', icon: 'user', file: 'profile' },
      { id: 'settings', label: 'Settings', icon: 'settings', file: 'settings' },
    ],
    modals: ['paywall', 'create-trip', 'add-expense'],
  },
  features: {
    analytics: { enabled: true, provider: 'posthog' },
    inAppPurchases: {
      enabled: true,
      tiers: [
        {
          id: 'free',
          name: 'Free',
          productId: '',
          description: 'Basic access',
          type: 'subscription',
          features: ['Basic features'],
        },
        {
          id: 'pro',
          name: 'Pro',
          productId: 'com.gastemplate.pro_monthly',
          description: 'Full access to all features',
          type: 'subscription',
          price: '$9.99/mo',
          features: ['All features', 'Priority support', 'Export data'],
          trialDays: 7,
        },
      ],
      oneTimePurchases: [],
      credits: {
        enabled: false,
        currencyName: 'credits',
        packs: [],
      },
    },
    darkMode: { enabled: true, default: 'system' },
    helpSystem: true,
    csvExport: true,
    ads: { enabled: false, provider: 'admob' },
    gamification: { enabled: false, elements: [] },
    search: { enabled: false, entities: [] },
    i18n: { enabled: false, locales: ['en'], defaultLocale: 'en' },
    onboarding: { enabled: false, steps: [] },
    pushNotifications: { enabled: true },
    auth: {
      google: false,
      apple: false,
      twitter: false,
      linkedin: false,
      microsoft: false,
      biometric: { enabled: true, timeoutMinutes: 15 },
    },
  },
  backend: {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
  compliance: {
    accountDeletionGracePeriod: { days: 30 },
    allowImmediateDeletion: false,
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
};
