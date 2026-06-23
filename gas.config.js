"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var gas_config_exports = {};
__export(gas_config_exports, {
  colors: () => colors,
  gasConfig: () => gasConfig
});
module.exports = __toCommonJS(gas_config_exports);
const gasConfig = {
  app: {
    name: "MyApp",
    slug: "my-app",
    description: "A great app built with Goodspeed Apps Studio",
    scheme: "my-app",
    version: "1.0.0",
    owner: "osritmos",
    minRuntimeVersion: "1.0.0",
    updateBranch: process.env.EXPO_PUBLIC_RELEASE_CHANNEL ?? "production"
  },
  design: {
    mood: "professional",
    colors: {
      primary: "#6366F1",
      primaryDark: "#818CF8",
      secondary: "#8B5CF6",
      accent: "#06B6D4",
      background: "#F5F5F7",
      backgroundDark: "#0D0D0F",
      surface: "#FFFFFF",
      surfaceDark: "#111114",
      text: "#111827",
      textDark: "#F9FAFB",
      textSecondary: "#6B7280",
      textSecondaryDark: "#9CA3AF",
      border: "#E5E7EB",
      borderDark: "#1E1E24",
      success: "#10B981",
      warning: "#F59E0B",
      error: "#EF4444"
    },
    typography: {
      displayFont: "system",
      bodyFont: "system",
      headingWeight: "700",
      monoFont: "monospace"
    },
    layout: {
      borderRadius: "lg",
      spacing: "comfortable",
      cardStyle: "elevated",
      buttonStyle: "rounded",
      navigationStyle: "standard"
    }
  },
  features: {
    auth: {
      email: true,
      google: true,
      apple: true,
      twitter: false,
      biometric: { enabled: true, timeoutMinutes: 5 },
      magicLink: false,
      guestMode: false
    },
    pushNotifications: {
      enabled: true,
      permissionTiming: "after_aha_moment",
      channels: ["default"]
    },
    inAppPurchases: {
      enabled: true,
      tiers: [
        {
          name: "Free",
          productId: "",
          price: "Free",
          features: ["Basic features", "Limited usage"]
        },
        {
          name: "Pro",
          productId: "pro_monthly",
          price: "$4.99/mo",
          features: ["Unlimited access", "Premium features", "Priority support"],
          trialDays: 7
        }
      ]
    },
    analytics: {
      enabled: true,
      provider: "posthog",
      crashReporting: false,
      sessionRecording: false,
      featureFlags: false
    },
    telemetry: {
      enabled: true,
      ingestUrl: process.env.EXPO_PUBLIC_TELEMETRY_INGEST_URL ?? "https://goodspeed.app/api/telemetry/ingest",
      flushIntervalMs: 3e4,
      maxQueueSize: 200,
      debugOverlay: false
    },
    darkMode: { enabled: true, default: "system" },
    offlineSync: { enabled: true, cachedEntities: [], syncStrategy: "on_reconnect" },
    gamification: { enabled: false, elements: [] },
    onboarding: { enabled: true, steps: ["welcome"] },
    helpSystem: true,
    search: { enabled: false, entities: [], implementation: "client-side" },
    socialSharing: { enabled: false, content: [], platforms: ["native"] },
    i18n: { enabled: false, locales: ["en"], defaultLocale: "en" },
    media: {
      imagePicker: false,
      camera: false,
      audioPlayback: false,
      videoPlayback: false,
      fileUpload: false
    },
    compliance: {
      attDialog: false,
      gdprConsent: false,
      ccpaNotice: false,
      ageGate: false,
      dataExport: true
    },
    ads: { enabled: false, provider: "admob" },
    notifications: {
      enabled: true,
      categories: {
        transactional: { enabled: true, defaultOn: true },
        product: { enabled: true, defaultOn: true },
        marketing: { enabled: true, defaultOn: false }
      },
      receiptPolling: {
        enabled: true,
        intervalMinutes: 5,
        expireAfterMinutes: 30
      }
    },
    backgroundFetch: false,
    csvExport: false,
    showBuiltWithBadge: false,
    anonymousAuth: {
      enabled: false,
      tables: []
      // operator opts in per-table
    }
  },
  navigation: {
    tabs: [
      { id: "home", label: "Home", icon: "Home", file: "index" },
      { id: "explore", label: "Explore", icon: "Compass", file: "explore" },
      { id: "settings", label: "Settings", icon: "Settings", file: "settings" }
    ],
    hiddenScreens: ["notifications"],
    modals: ["paywall"]
  },
  backend: {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
    },
    revenuecat: {
      iosKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "",
      androidKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? ""
    },
    posthog: {
      apiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "",
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
    },
    // NOTE (L-13): EXPO_PUBLIC_TELEMETRY_INGEST_SECRET is bundled into the public app build.
    // It is an identity tag for HMAC attribution, not an auth credential. See the security
    // note on `GasBackendConfig.telemetry.ingestSecret` above for the full explanation.
    // Server-side rate limits + replay protection on the ingest endpoint (not this value)
    // are the actual security boundary. The string is recoverable from any shipped APK/IPA.
    telemetry: {
      ingestSecret: process.env.EXPO_PUBLIC_TELEMETRY_INGEST_SECRET ?? ""
    }
  },
  privacy: {
    dataCategories: [
      { type: "NSPrivacyCollectedDataTypeName", linked: true, tracking: false, purposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { type: "NSPrivacyCollectedDataTypeEmailAddress", linked: true, tracking: false, purposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { type: "NSPrivacyCollectedDataTypeUserID", linked: true, tracking: false, purposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { type: "NSPrivacyCollectedDataTypeCrashData", linked: false, tracking: false, purposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { type: "NSPrivacyCollectedDataTypePerformanceData", linked: false, tracking: false, purposes: ["NSPrivacyCollectedDataTypePurposeAnalytics"] },
      { type: "NSPrivacyCollectedDataTypeProductInteraction", linked: false, tracking: false, purposes: ["NSPrivacyCollectedDataTypePurposeAnalytics"] }
    ],
    trackingDomains: [],
    attUsageDescription: "We use device identifiers to deliver relevant content and measure engagement. You can opt out in Settings.",
    attTriggerEvent: "first_launch"
  },
  // Compliance: canonical authoring source for both client (UI in
  // app/(modal)/data-rights.tsx) and server (edge functions). After editing,
  // mirror the deletion values into Supabase Function secrets:
  //   supabase secrets set ACCOUNT_DELETION_GRACE_DAYS=<days> ALLOW_IMMEDIATE_DELETION=<true|false>
  // The compliance-config-sync smoke test fails if these drift.
  compliance: {
    accountDeletionGracePeriod: { days: 30 },
    allowImmediateDeletion: true,
    exportTables: ["profiles", "push_tokens", "notifications", "user_bookmarks", "feedback", "consent_log"],
    consentBannerRequired: "eu_only"
  },
  observability: {
    sentryDsn: process.env.SENTRY_DSN ?? "",
    tracesSampleRate: 0.1,
    enableSessionReplay: true
  },
  costBudgets: {
    defaults: {}
  },
  releaseChannels: {
    current: "production",
    storeUrl: {
      ios: "",
      android: ""
    }
  },
  performance: {
    maxBundleSizeMB: 8,
    coldStartTargetMs: 2500
  },
  media: {
    provider: "supabase",
    maxUploadBytes: 5 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    defaultBucket: "attachments",
    maxImageEdge: 2048,
    signedUrlTtlSeconds: 3600
  },
  search: {
    defaultLanguage: "english",
    defaultLimit: 20,
    maxLimit: 100
  },
  realtime: {
    presenceTimeoutMs: 3e4,
    autoReconnect: true,
    defaultRetries: 3
  },
  integrations: {
    oauthProviders: []
  },
  e2e: {
    framework: "maestro",
    cloudWorkspaceId: ""
  },
  llm: {
    provider: "openai",
    defaultChatModel: "gpt-4o-mini",
    defaultEmbedModel: "text-embedding-3-small",
    defaultTranscribeModel: "whisper-1",
    costScope: "llm",
    budgetPeriod: "day"
  },
  ui: {
    breakpoints: { tablet: 600, desktop: 1024 },
    honorDynamicType: true,
    honorReducedMotion: true
  },
  multiTenancy: {
    enabled: false,
    defaultRole: "member"
  },
  growth: {
    experimentsEnabled: true,
    defaultBackgroundSyncInterval: 6e4,
    referralCodeLength: 8
  },
  admin: {
    enabled: true,
    defaultRoleCheck: "profiles.role"
  },
  monitoring: {
    crashFreeThresholds: {
      production: { ios: 99.5, android: 99 },
      staging: 95,
      preview: 0
      // disabled
    },
    crashFreeWindow: "24h"
  }
};
const colors = gasConfig.design.colors;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  colors,
  gasConfig
});
