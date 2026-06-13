/**
 * GAS Template — Master Configuration
 *
 * Auto-generated from AppArchitecture by DevAgent.
 * This is the SINGLE SOURCE OF TRUTH for app identity, design, features, and navigation.
 *
 * Usage:
 *   import { gasConfig } from '../gas.config';
 */

// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface GasAppConfig {
  name: string;
  slug: string;
  description: string;
  scheme: string;
  version: string;
  minRuntimeVersion: string;
  appStoreUrl?: string;
  owner: string;
}

export interface GasColorPalette {
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
}

export interface GasTypography {
  displayFont: 'system' | string;
  bodyFont: 'system' | string;
  headingWeight: '700' | '600' | '500';
  monoFont: 'monospace' | string;
}

export interface GasLayout {
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  spacing: 'compact' | 'comfortable' | 'spacious';
  cardStyle: 'flat' | 'elevated' | 'outlined' | 'filled';
  buttonStyle: 'rounded' | 'pill' | 'square';
  navigationStyle: 'standard' | 'floating' | 'minimal' | 'icon-only';
}

export interface GasDesignSystem {
  mood: 'minimal' | 'playful' | 'professional' | 'bold' | 'warm' | 'energetic' | 'calm' | 'dark';
  colors: GasColorPalette;
  typography: GasTypography;
  layout: GasLayout;
}

export interface GasAuthFeatures {
  email: true;
  google: boolean;
  apple: boolean;
  twitter: boolean;
  // Extended Supabase-supported OAuth providers (architectureToGasConfig emits
  // these from cc.socialLogin.providers; the runtime config carries them so
  // generated screens can branch on gasConfig.features.auth[provider]). All
  // optional so reads against gas-template's narrower GasAuthFeatures (which
  // only declares linkedin?/microsoft?) typecheck without a contract drift.
  github?: boolean;
  facebook?: boolean;
  discord?: boolean;
  linkedin?: boolean;
  microsoft?: boolean;
  spotify?: boolean;
  slack?: boolean;
  twitch?: boolean;
  notion?: boolean;
  figma?: boolean;
  biometric: { enabled: boolean; timeoutMinutes: number };
  magicLink: boolean;
  guestMode: boolean;
  mfa?: boolean;
}

export interface GasAdsFeatures {
  enabled: boolean;
  provider: 'admob' | 'applovin' | 'unity' | string;
}

export interface GasNotificationsConfig {
  enabled: boolean;
  categories: {
    transactional: { enabled: boolean; defaultOn: boolean };
    product: { enabled: boolean; defaultOn: boolean };
    marketing: { enabled: boolean; defaultOn: boolean };
  };
  receiptPolling: { enabled: boolean; intervalMinutes: number; expireAfterMinutes: number };
}

export interface GasTelemetryFeatures {
  enabled: boolean;
  flushIntervalMs: number;
  maxQueueSize: number;
  debugOverlay: boolean;
  ingestUrl: string;
}

export interface GasAnonymousAuthFeatures {
  enabled: boolean;
  tables: string[];
}

export interface GasPushNotificationFeatures {
  enabled: boolean;
  permissionTiming: 'after_aha_moment' | 'onboarding' | 'explicit_opt_in';
  channels: string[];
}

export interface GasSubscriptionTier {
  name: string;
  productId: string;
  price: string;
  features: string[];
  trialDays?: number;
}

// Optional purchase shapes the gas-template's hooks/screens read from
// gasConfig.features.inAppPurchases.{oneTimePurchases,credits,marketplace}.
// Mirror gas-template/gas.config.ts so a generated app's inferred type matches
// what the template code expects to find. Without these the runtime emit's
// literal type is missing the fields and every read becomes a TS2339.
export interface GasOneTimePurchase {
  id: string;
  productId: string;
  name: string;
  price: string;
  description: string;
  type: 'lifetime' | 'feature_pack' | 'content';
  entitlement?: string;
}

export interface GasCreditPack {
  id: string;
  productId: string;
  name: string;
  credits: number;
  price: string;
  popular?: boolean;
  bonusCredits?: number;
}

export interface GasCreditsConfig {
  enabled: boolean;
  currencyName: string;
  currencyNamePlural: string;
  iconName: string;
  packs: GasCreditPack[];
  initialBalance?: number;
}

export interface GasMarketplaceConfig {
  enabled: boolean;
  platformFeePercent: number;
  sellerPayoutMethod: 'stripe_connect';
  listingCategories: string[];
  requiresApproval: boolean;
  escrowEnabled: boolean;
}

export interface GasInAppPurchaseFeatures {
  enabled: boolean;
  tiers: GasSubscriptionTier[];
  oneTimePurchases?: GasOneTimePurchase[];
  credits?: GasCreditsConfig;
  marketplace?: GasMarketplaceConfig;
}

export interface GasAnalyticsFeatures {
  enabled: boolean;
  provider: 'posthog';
  crashReporting: boolean;
  sessionRecording: boolean;
  featureFlags: boolean;
}

export interface GasDarkModeFeatures {
  enabled: boolean;
  default: 'system' | 'dark' | 'light';
}

export interface GasOfflineSyncFeatures {
  enabled: boolean;
  cachedEntities: string[];
  syncStrategy: 'on_reconnect' | 'periodic';
  encrypted?: boolean;
}

export interface GasGamificationFeatures {
  enabled: boolean;
  elements: string[];
}

export interface GasOnboardingFeatures {
  enabled: boolean;
  steps: string[];
}

export interface GasSearchFeatures {
  enabled: boolean;
  entities: string[];
  implementation: 'client-side' | 'supabase-fts';
}

export interface GasSocialSharingFeatures {
  enabled: boolean;
  content: string[];
  platforms: string[];
}

export interface GasI18nFeatures {
  enabled: boolean;
  locales: string[];
  defaultLocale: string;
}

export interface GasMediaFeatures {
  imagePicker: boolean;
  camera: boolean;
  audioPlayback: boolean;
  videoPlayback: boolean;
  fileUpload: boolean;
}

export interface GasComplianceFeatures {
  attDialog: boolean;
  gdprConsent: boolean;
  ccpaNotice: boolean;
  ageGate: boolean;
  dataExport: boolean;
}

export interface GasFeatures {
  auth: GasAuthFeatures;
  pushNotifications: GasPushNotificationFeatures;
  inAppPurchases: GasInAppPurchaseFeatures;
  analytics: GasAnalyticsFeatures;
  darkMode: GasDarkModeFeatures;
  offlineSync: GasOfflineSyncFeatures;
  gamification: GasGamificationFeatures;
  onboarding: GasOnboardingFeatures;
  helpSystem: boolean;
  search: GasSearchFeatures;
  socialSharing: GasSocialSharingFeatures;
  i18n: GasI18nFeatures;
  media: GasMediaFeatures;
  compliance: GasComplianceFeatures;
  // Always-emitted runtime feature flags (architectureToGasConfig sets safe-off
  // defaults). Declared here so generated code that reads e.g.
  // gasConfig.features.ads.enabled typechecks and runs without crashing.
  ads: GasAdsFeatures;
  notifications: GasNotificationsConfig;
  telemetry: GasTelemetryFeatures;
  anonymousAuth: GasAnonymousAuthFeatures;
  backgroundFetch: boolean;
  csvExport: boolean;
  showBuiltWithBadge: boolean;
}

export interface GasTabConfig {
  id: string;
  label: string;
  icon: string;
  file: string;
}

export interface GasNavigation {
  tabs: GasTabConfig[];
  hiddenScreens: string[];
  modals: string[];
}

export interface GasBackendConfig {
  supabase: { url: string; anonKey: string };
  revenuecat: { iosKey: string; androidKey: string };
  posthog: { apiKey: string; host: string };
  // Telemetry ingest identity tag — sourced from EXPO_PUBLIC_TELEMETRY_INGEST_SECRET.
  // Matches gas-template's GasBackendConfig.telemetry; codegen MUST emit a (possibly
  // empty-string) value so generated apps' TelemetryProvider can read it without
  // crashing on undefined.
  telemetry: { ingestSecret: string };
  // Stripe publishable key for marketplace apps — sourced from
  // EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY. Optional on gas-template's GasBackendConfig
  // (only marketplace.enabled apps read it via lib/stripe.ts), so we always emit a
  // safe-off empty-string value at codegen time and let the runtime gate
  // (marketplace.enabled AND stripe.publishableKey) decide whether to init Stripe.
  stripe?: { publishableKey: string };
}

export interface GasConfig {
  app: GasAppConfig;
  design: GasDesignSystem;
  features: GasFeatures;
  navigation: GasNavigation;
  releaseChannels: { current: string; storeUrl: { ios: string; android: string } };
  compliance: {
    accountDeletionGracePeriod: { days: number };
    allowImmediateDeletion: boolean;
    exportTables: string[];
    consentBannerRequired: string;
  };
  ui: { breakpoints: { tablet: number; desktop: number }; honorDynamicType: boolean; honorReducedMotion: boolean };
  multiTenancy: { enabled: boolean; defaultRole: string };
  integrations: { oauthProviders: Array<{ provider: string; scopes?: string[]; refreshUrl?: string; refreshThresholdMinutes?: number }> };
  growth: { experimentsEnabled: boolean; defaultBackgroundSyncInterval: number; referralCodeLength: number };
  // Round-6 additions — gas-template declares each of these top-level interfaces
  // and runtime consumers (services/{media,search,llm}.ts, channel subscription
  // helper) read them. Required to keep TelemetryProvider-class crashes from
  // reappearing the moment a generated app uses these subsystems.
  media: { provider: string; maxUploadBytes: number; allowedContentTypes: string[]; defaultBucket: string; maxImageEdge: number; signedUrlTtlSeconds: number };
  search: { defaultLanguage: string; defaultLimit: number; maxLimit: number };
  realtime: { presenceTimeoutMs: number; autoReconnect: boolean; defaultRetries: number };
  llm: { provider: string; defaultChatModel: string; defaultEmbedModel: string; defaultTranscribeModel: string; costScope: string; budgetPeriod: string; defaultMaxTokens?: number };
  backend: GasBackendConfig;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export const gasConfig: GasConfig = {
  "app": {
    "name": "GolfTrip Organizer",
    "slug": "golftrip-organizer",
    "description": "GolfTrip Organizer eliminates 10-20 hours of trip coordination by consolidating tee time management, group itineraries, automatic cost splitting, and real-time group communication into a single trip workspace — giving every member one source of truth from the first invite link through final settlement.",
    "scheme": "golftrip-organizer",
    "version": "1.0.0",
    "minRuntimeVersion": "1.0.0",
    "appStoreUrl": "",
    "owner": "goodspeed_app_studio"
  },
  "design": {
    "mood": "warm",
    "colors": {
      "text": "#1C1C1E",
      "error": "#9B2226",
      "accent": "#C9A84C",
      "border": "#DDD8CC",
      "primary": "#1A3A2A",
      "success": "#2D6A4F",
      "surface": "#FDFAF4",
      "warning": "#B07D2A",
      "textDark": "#EDE8DE",
      "secondary": "#2C4A3E",
      "background": "#F5F0E8",
      "borderDark": "#2E3D34",
      "primaryDark": "#2C5A40",
      "surfaceDark": "#1C2B22",
      "textSecondary": "#5C5C4A",
      "backgroundDark": "#121A16",
      "textSecondaryDark": "#9EA89A"
    },
    "typography": {
      "bodyFont": "Manrope",
      "monoFont": "Courier New",
      "displayFont": "Outfit",
      "headingWeight": "700"
    },
    "layout": {
      "spacing": "comfortable",
      "cardStyle": "flat",
      "buttonStyle": "pill",
      "borderRadius": "xl",
      "navigationStyle": "standard"
    }
  },
  "features": {
    "auth": {
      "email": true,
      "google": true,
      "apple": true,
      "twitter": false,
      "github": false,
      "facebook": true,
      "discord": false,
      "linkedin": false,
      "microsoft": false,
      "spotify": false,
      "slack": false,
      "twitch": false,
      "notion": false,
      "figma": false,
      "biometric": {
        "enabled": true,
        "timeoutMinutes": 5
      },
      "magicLink": false,
      "guestMode": false,
      "mfa": false
    },
    "pushNotifications": {
      "enabled": true,
      "permissionTiming": "after_aha_moment",
      "channels": [
        "New chat message in your trip",
        "Organizer announcement posted",
        "New member joined your trip",
        "Expense added — your share updated",
        "Scores entered — leaderboard updated",
        "Trip starts tomorrow — check itinerary",
        "Round finished? Log scores now (Day 3-5 post-round retention hook)",
        "Your trip is complete — generate your Recap Card"
      ]
    },
    "inAppPurchases": {
      "enabled": true,
      "tiers": [
        {
          "name": "Free",
          "productId": "golftrip_free",
          "price": "$0",
          "features": [
            "Unlimited trip creation and editing",
            "Full group itinerary management",
            "Tee time manual entry and email import",
            "Expense logging with golf-specific categories",
            "Automatic cost split calculation (unequal splits by participation)",
            "Settlement summary with manual 'Mark Settled' tracking",
            "Group chat with day/course threading",
            "Organizer announcements",
            "Round scorecard entry (total scores)",
            "Trip leaderboard",
            "Guest access via invite link (no account required)",
            "RSVP tracking",
            "Up to 20 members per trip",
            "Past trips archive"
          ]
        },
        {
          "name": "Recap Unlock",
          "productId": "golftrip_recap_onetime",
          "price": "$2.99",
          "features": [
            "Post-trip shareable Recap Card (Instagram Stories / iMessage optimized)",
            "Downloadable trip summary image",
            "Trip stats: winner, best round, group average, total cost per person",
            "Unlocked permanently for that trip"
          ]
        },
        {
          "name": "Pro",
          "productId": "golftrip_pro_annual",
          "price": "$14.99/year",
          "features": [
            "All Recap Cards included for every trip (unlimited)",
            "In-app payment settlement tracking with Venmo/PayPal deep-link integration",
            "Hole-by-hole scorecard entry",
            "Game format library (Skins, Nassau, Stableford, Wolf — auto-calculated side bets)",
            "Up to 50 members per trip",
            "Year-over-year performance comparison across all trips",
            "Priority email support"
          ],
          "trialDays": 7
        }
      ],
      "oneTimePurchases": [],
      "credits": {
        "enabled": false,
        "currencyName": "credit",
        "currencyNamePlural": "credits",
        "iconName": "Coins",
        "packs": []
      },
      "marketplace": {
        "enabled": false,
        "platformFeePercent": 0,
        "sellerPayoutMethod": "stripe_connect",
        "listingCategories": [],
        "requiresApproval": true,
        "escrowEnabled": false
      }
    },
    "analytics": {
      "enabled": true,
      "provider": "posthog",
      "crashReporting": false,
      "sessionRecording": false,
      "featureFlags": false
    },
    "darkMode": {
      "enabled": true,
      "default": "system"
    },
    "offlineSync": {
      "enabled": true,
      "cachedEntities": [
        "trips",
        "teeTimes",
        "expenses",
        "members",
        "messages",
        "leaderboard"
      ],
      "syncStrategy": "on_reconnect",
      "encrypted": false
    },
    "gamification": {
      "enabled": true,
      "elements": [
        "Trip leaderboard with live rank positions and animated re-sorting",
        "Winner crown badge (gold) on leaderboard rank #1 position",
        "Round achievement badges: Best Round of the Trip, Most Improved, Closest to Pin (if side bets enabled)",
        "Milestone toasts: 'First expense logged!', 'Full group joined!', 'All rounds complete!'",
        "Year-over-year improvement comparison on Profile ('Your group shot 3.2 strokes better this year')",
        "Trip streak counter on Profile (number of consecutive years with a group trip)"
      ]
    },
    "onboarding": {
      "enabled": true,
      "steps": [
        "welcome",
        "step-2",
        "step-3",
        "step-4",
        "step-5",
        "step-6",
        "step-7"
      ]
    },
    "helpSystem": true,
    "search": {
      "enabled": true,
      "entities": [
        "trips",
        "courses",
        "members",
        "expenses"
      ],
      "implementation": "supabase-fts"
    },
    "socialSharing": {
      "enabled": true,
      "content": [
        "Trip invite link (shareable via SMS, email, iMessage, WhatsApp)",
        "Post-trip Recap Card (styled image optimized for Instagram Stories and iMessage)",
        "Leaderboard screenshot (auto-generated sharable card with winner name and scores)",
        "Individual round scorecard"
      ],
      "platforms": [
        "iMessage",
        "WhatsApp",
        "Instagram Stories",
        "Email",
        "System Share Sheet"
      ]
    },
    "i18n": {
      "enabled": false,
      "locales": [
        "en-US"
      ],
      "defaultLocale": "en-US"
    },
    "media": {
      "imagePicker": false,
      "camera": false,
      "audioPlayback": false,
      "videoPlayback": false,
      "fileUpload": false
    },
    "compliance": {
      "attDialog": false,
      "gdprConsent": false,
      "ccpaNotice": false,
      "ageGate": false,
      "dataExport": true
    },
    "ads": {
      "enabled": false,
      "provider": "admob"
    },
    "notifications": {
      "enabled": true,
      "categories": {
        "transactional": {
          "enabled": true,
          "defaultOn": true
        },
        "product": {
          "enabled": true,
          "defaultOn": true
        },
        "marketing": {
          "enabled": true,
          "defaultOn": false
        }
      },
      "receiptPolling": {
        "enabled": true,
        "intervalMinutes": 5,
        "expireAfterMinutes": 30
      }
    },
    "telemetry": {
      "enabled": true,
      "flushIntervalMs": 30000,
      "maxQueueSize": 200,
      "debugOverlay": false,
      "ingestUrl": "https://goodspeed.app/api/telemetry/ingest"
    },
    "anonymousAuth": {
      "enabled": false,
      "tables": []
    },
    "backgroundFetch": true,
    "csvExport": false,
    "showBuiltWithBadge": false
  },
  "navigation": {
    "tabs": [
      {
        "id": "dashboard",
        "label": "Dashboard — My Trips",
        "icon": "Home",
        "file": "dashboard"
      },
      {
        "id": "profile",
        "label": "Profile & Trip History",
        "icon": "User",
        "file": "profile"
      },
      {
        "id": "settings",
        "label": "Settings",
        "icon": "Settings",
        "file": "settings"
      }
    ],
    "hiddenScreens": [
      "trip"
    ],
    "modals": [
      "paywall"
    ]
  },
  "releaseChannels": {
    "current": "production",
    "storeUrl": {
      "ios": "",
      "android": ""
    }
  },
  "compliance": {
    "accountDeletionGracePeriod": {
      "days": 30
    },
    "allowImmediateDeletion": true,
    "exportTables": [
      "profiles",
      "push_tokens",
      "notifications",
      "user_bookmarks",
      "feedback",
      "consent_log"
    ],
    "consentBannerRequired": "eu_only"
  },
  "ui": {
    "breakpoints": {
      "tablet": 600,
      "desktop": 1024
    },
    "honorDynamicType": true,
    "honorReducedMotion": true
  },
  "multiTenancy": {
    "enabled": false,
    "defaultRole": "member"
  },
  "integrations": {
    "oauthProviders": []
  },
  "growth": {
    "experimentsEnabled": true,
    "defaultBackgroundSyncInterval": 60000,
    "referralCodeLength": 8
  },
  "media": {
    "provider": "supabase",
    "maxUploadBytes": 10485760,
    "allowedContentTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ],
    "defaultBucket": "uploads",
    "maxImageEdge": 2048,
    "signedUrlTtlSeconds": 3600
  },
  "search": {
    "defaultLanguage": "en",
    "defaultLimit": 20,
    "maxLimit": 100
  },
  "realtime": {
    "presenceTimeoutMs": 30000,
    "autoReconnect": true,
    "defaultRetries": 3
  },
  "llm": {
    "provider": "anthropic",
    "defaultChatModel": "claude-opus-4-1",
    "defaultEmbedModel": "claude-3-5-sonnet-20241022",
    "defaultTranscribeModel": "whisper-1",
    "costScope": "monthly",
    "budgetPeriod": "month"
  },
  "backend": {
    "supabase": {
      "url": "",
      "anonKey": ""
    },
    "revenuecat": {
      "iosKey": "",
      "androidKey": ""
    },
    "posthog": {
      "apiKey": "",
      "host": "https://us.i.posthog.com"
    },
    "telemetry": {
      "ingestSecret": ""
    },
    "stripe": {
      "publishableKey": ""
    }
  }
};
export default gasConfig;
