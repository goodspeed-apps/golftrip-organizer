/**
 * GAS Config Types
 *
 * Canonical TypeScript types for gasConfig.
 * All fields used across the template must be declared here.
 */

export interface IAPTier {
  name: string;
  productId: string;
  price: number;
  features: string[];
  trialDays?: number;
}

export interface IAPOneTimePurchase {
  id: string;
  name: string;
  productId: string;
  price: number;
  description?: string;
}

export interface CreditPack {
  id: string;
  credits: number;
  bonusCredits?: number;
  productId: string;
  price: number;
  label: string;
}

export interface CreditsConfig {
  enabled: boolean;
  currencyName: string;
  packs: CreditPack[];
}

export interface InAppPurchasesConfig {
  enabled: boolean;
  tiers: IAPTier[];
  oneTimePurchases?: IAPOneTimePurchase[];
  credits?: CreditsConfig;
}

export interface MarketplaceConfig {
  enabled: boolean;
  requiresApproval: boolean;
  commissionPercent: number;
  platformFeePercent?: number;
  listingCategories?: string[];
  sellerPayoutMethod?: string;
}

export interface ComplianceConfig {
  accountDeletionGracePeriod: {
    days: number;
  };
  immediateDeleteAllowed: boolean;
  allowImmediateDeletion?: boolean;
}

export interface GASConfig {
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
      [key: string]: string;
    };
    typography: {
      displayFont?: string;
      bodyFont?: string;
      monoFont?: string;
      headingWeight: '400' | '500' | '600' | '700' | '800' | '900';
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
    inAppPurchases: InAppPurchasesConfig;
    darkMode: { enabled: boolean };
    gamification: { enabled: boolean; elements: string[] };
    search: { enabled: boolean; entities: string[] };
    i18n: { enabled: boolean; locales: string[]; defaultLocale: string };
    onboarding: { enabled: boolean; steps: string[] };
    auth: {
      google: boolean;
      apple: boolean;
      twitter: boolean;
      linkedin: boolean;
      microsoft: boolean;
      biometric: { enabled: boolean; timeoutMinutes: number };
      mfa?: boolean;
    };
    pushNotifications: { enabled: boolean };
    helpSystem: boolean;
    csvExport: boolean;
    ads: { enabled: boolean; provider: string };
    telemetry?: { enabled: boolean; debugOverlay?: boolean };
    marketplace?: MarketplaceConfig;
    anonymousAuth?: { enabled: boolean; tables: string[] };
  };
  compliance: ComplianceConfig;
  backend: {
    supabase: {
      url: string;
      anonKey: string;
    };
  };
  media: {
    maxImageEdge: number;
    maxUploadBytes: number;
    allowedContentTypes: string[];
    defaultBucket: string;
    signedUrlTtlSeconds: number;
  };
  llm: {
    provider: string;
    defaultChatModel?: string;
    defaultEmbedModel?: string;
    defaultTranscribeModel?: string;
    defaultMaxTokens?: number;
    budgetPeriod?: string;
    costScope?: string;
  };
}
