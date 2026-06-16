# GAS Template - Feature Catalog (246 Features)

Every feature an app might need, classified by tier and template status.

**Tiers:**
- **Core** = every app needs it (always included, always enabled)
- **Common** = most apps benefit (included in template, enabled via `gas.config.ts` flag)
- **Specialized** = some apps need it (template pattern available, wired on demand by DevAgent)

**Template Status:**
- **Static** = code exists in template, works out of the box
- **Config-toggled** = static code, enabled/disabled via `gas.config.ts`
- **Template pattern** = reusable pattern in template, DevAgent adapts for the app
- **Per-app** = DevAgent generates from scratch for this specific app

**Coverage: 187/246 (76%) templated.** The DevAgent only generates the 24% that's truly app-specific.

---

## 1. Authentication & Identity (18 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 1.1 | Email/Password Auth | Core | Static | `features.auth.email` (always true) |
| 1.2 | Email Verification (magic link/OTP) | Core | Static | - |
| 1.3 | Google OAuth | Core | Config-toggled | `features.auth.google` |
| 1.4 | Apple Sign-In | Core | Config-toggled | `features.auth.apple` |
| 1.5 | Twitter/X OAuth | Common | Config-toggled | `features.auth.twitter` |
| 1.6 | LinkedIn/Microsoft OAuth | Specialized | Config-toggled | `features.auth.linkedin` / `.microsoft` |
| 1.7 | Phone/SMS Auth (OTP) | Common | Template pattern | - |
| 1.8 | Magic Link (Passwordless) | Common | Static | - |
| 1.9 | Biometric Auth (Face ID/Touch ID) | Core | Config-toggled | `features.auth.biometric.enabled` |
| 1.10 | Session Management (auto-refresh) | Core | Static | - |
| 1.11 | Auth State Listener (nav guard) | Core | Static | - |
| 1.12 | Password Reset | Core | Static | - |
| 1.13 | Account Deletion | Core | Static | - |
| 1.14 | Multi-Device Session mgmt | Specialized | Per-app | - |
| 1.15 | OAuth Deep Link Callback | Core | Static | `app.scheme` |
| 1.16 | Guest/Anonymous Mode | Common | Template pattern | - |
| 1.17 | Account Linking (anon→social) | Specialized | Per-app | - |
| 1.18 | Multi-Factor Auth (TOTP) | Specialized | Template pattern | `features.auth.twoFactor` |

**Key files:** `hooks/useAuth.ts`, `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`, `app/auth/callback.tsx`, `lib/supabase.ts`

---

## 2. Onboarding & First-Run (11 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 2.1 | Welcome Screen | Core | Static | - |
| 2.2 | Multi-Step Onboarding (2-5 steps) | Core | Template structure | `features.onboarding.steps` |
| 2.3 | Permission Priming screens | Core | Static | - |
| 2.4 | Progressive Profiling | Common | Per-app | - |
| 2.5 | Carousel/Swipe Tutorial | Common | Static component | `components/ui/OnboardingCarousel.tsx` |
| 2.6 | Interactive Walkthrough (coach marks) | Common | Static | `components/WalkthroughModal.tsx` |
| 2.7 | Skip Onboarding option | Core | Static | - |
| 2.8 | Onboarding Completion Tracking | Core | Static | - |
| 2.9 | A/B Testable Onboarding (PostHog) | Specialized | Template pattern | - |
| 2.10 | Social Proof during signup | Common | Per-app content | - |
| 2.11 | Personalization Quiz | Common | Per-app | - |

**Key files:** `app/(auth)/onboarding/`, `components/WalkthroughModal.tsx`, `components/HowToUseModal.tsx`

---

## 3. Navigation & Layout (18 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 3.1 | Bottom Tab Navigation | Core | Config-driven | `navigation.tabs` |
| 3.2 | Stack Navigation | Core | Static | - |
| 3.3 | Auth Route Group `(auth)` | Core | Static | - |
| 3.4 | Modal Route Group `(modal)` | Core | Static | - |
| 3.5 | Auth Guard/Redirect | Core | Static | - |
| 3.6 | Nested Tab Stacks (list→detail) | Common | Template pattern | `navigation.hiddenScreens` |
| 3.7 | Drawer Navigation | Specialized | Per-app | - |
| 3.8 | Dynamic Routes `[id].tsx` | Core | Static | - |
| 3.9 | Type-Safe Routes | Core | Static | - |
| 3.10 | Custom Tab Bar (animated) | Common | Template pattern | `design.layout.navigationStyle` |
| 3.11 | Floating Action Button (FAB) | Common | Static component | `components/ui/FAB.tsx` |
| 3.12 | Bottom Sheet | Common | Static component | - |
| 3.13 | Header Configuration | Core | Template pattern | - |
| 3.14 | Safe Area Handling | Core | Static | - |
| 3.15 | Status Bar Management | Core | Static | - |
| 3.16 | Splash Screen | Core | Static | - |
| 3.17 | Not Found / Error Screen | Core | Static | `app/+not-found.tsx` |
| 3.18 | Pull-to-Refresh | Core | Template pattern | - |

**Key files:** `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(modal)/_layout.tsx`, `app/index.tsx`

---

## 4. UI/UX Foundation (22 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 4.1 | Dark Mode (system/manual) | Core | Static | `features.darkMode` |
| 4.2 | Design Token System | Core | Config-driven | `design.colors`, `design.layout` |
| 4.3 | Responsive Layout | Core | Static | - |
| 4.4 | Dynamic Type / Text Scaling | Core | Static | - |
| 4.5 | Accessibility Labels (VoiceOver) | Core | Template rules | - |
| 4.6 | Minimum Touch Targets (44pt) | Core | Template rules | - |
| 4.7 | Contrast Ratios (WCAG 4.5:1) | Core | Validation | `__tests__/smoke.test.ts` |
| 4.8 | Haptic Feedback | Common | Static | - |
| 4.9 | Micro-Animations (FadeIn, spring) | Common | Static | - |
| 4.10 | Skeleton Loading | Core | Static component | `components/ui/LoadingSkeleton.tsx` |
| 4.11 | Empty State (icon + CTA) | Core | Static component | `components/ui/EmptyState.tsx` |
| 4.12 | Error State / Error Boundary | Core | Static | `components/ErrorBoundary.tsx` |
| 4.13 | Toast / Snackbar system | Core | Static | `components/Toast.tsx` |
| 4.14 | Loading Indicators | Core | Static | - |
| 4.15 | Keyboard Avoidance | Core | Template pattern | - |
| 4.16 | Gesture Handling (swipe actions) | Common | Template pattern | - |
| 4.17 | Custom Fonts | Common | Template pattern | `design.typography` |
| 4.18 | Animated Screen Transitions | Specialized | Template pattern | - |
| 4.19 | Reduced Motion (a11y respect) | Core | Template pattern | - |
| 4.20 | Orientation Lock | Core | Static | `app.json` |
| 4.21 | Color Blind Safe design | Common | Design system | - |
| 4.22 | Focus Management (screen reader) | Core | Template pattern | - |

**Key files:** `lib/theme.ts`, `context/ThemeContext.tsx`, `hooks/useTheme.ts`, `components/ui/`, `components/Toast.tsx`, `components/ErrorBoundary.tsx`

---

## 5. Data & Backend (18 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 5.1 | Supabase Client Init (PKCE + SecureStore) | Core | Static | - |
| 5.2 | Database Types (auto-generated) | Core | Per-app | - |
| 5.3 | Row-Level Security (RLS) | Core | Per-app | - |
| 5.4 | Edge Functions | Common | Per-app | - |
| 5.5 | Offline Cache (AsyncStorage + TTL) | Core | Static | `features.offlineSync.enabled` |
| 5.6 | Offline Write Queue | Core | Static | - |
| 5.7 | Network Status Monitor | Core | Static | - |
| 5.8 | Realtime Subscriptions | Common | Template pattern | - |
| 5.9 | Optimistic Updates | Common | Template pattern | - |
| 5.10 | Pagination (cursor/offset) | Core | Template pattern | - |
| 5.11 | Data Validation (Zod) | Core | Template pattern | - |
| 5.12 | API Error Handling (consistent) | Core | Static | - |
| 5.13 | Request Deduplication | Common | Template pattern | - |
| 5.14 | Background Data Sync | Specialized | Static | `features.backgroundFetch.enabled` |
| 5.15 | File Upload (Supabase Storage) | Common | Template pattern | - |
| 5.16 | Data Migration/Versioning | Common | Per-app | - |
| 5.17 | Seed Data | Common | Per-app | - |
| 5.18 | Stale-While-Revalidate | Common | Template pattern | - |

**Key files:** `lib/supabase.ts`, `lib/offline.ts`, `hooks/useOfflineSync.ts`, `services/api.ts`

---

## 6. Monetization (16 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 6.1 | RevenueCat Init | Core | Static | - |
| 6.2 | Subscription State Hook | Core | Static | `hooks/useSubscription.ts` |
| 6.3 | Paywall Screen | Core | Template + per-app design | `app/(modal)/paywall.tsx` |
| 6.4 | Soft Paywall (usage gates) | Core | Template pattern | `hooks/usePaywall.ts` |
| 6.5 | Hard Paywall (screen block) | Common | Template pattern | - |
| 6.6 | Free Trial | Core | Static | `features.inAppPurchases.tiers[].trialDays` |
| 6.7 | Restore Purchases | Core | Static | - |
| 6.8 | Lifetime Purchase | Common | Config per app | - |
| 6.9 | Consumable IAP | Specialized | Per-app | - |
| 6.10 | Subscription Management | Core | Static | - |
| 6.11 | Price Localization | Core | Automatic (RevenueCat) | - |
| 6.12 | Promotional Offers | Specialized | Per-app | - |
| 6.13 | Paywall A/B Testing | Common | Template pattern | - |
| 6.14 | Server-Side Entitlement Verify | Common | Template pattern | - |
| 6.15 | Trial Expiry Notification | Common | Template pattern | - |
| 6.16 | Ads Integration | Specialized | Per-app | - |

**Key files:** `lib/revenuecat.ts`, `hooks/useSubscription.ts`, `hooks/usePaywall.ts`, `app/(modal)/paywall.tsx`

---

## 7. Analytics & Tracking (16 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 7.1 | PostHog Init (null-safe) | Core | Static | - |
| 7.2 | User Identification | Core | Static | - |
| 7.3 | Screen Tracking (auto) | Core | Static | - |
| 7.4 | Custom Event Tracking | Core | Static | `hooks/useAnalytics.ts` |
| 7.5 | Funnel Analysis events | Core | Template pattern | - |
| 7.6 | User Properties | Core | Static | - |
| 7.7 | Feature Flag Client | Common | Static | - |
| 7.8 | Session Recording (mobile) | Specialized | Static | - |
| 7.9 | Revenue Attribution | Common | Template pattern | - |
| 7.10 | Crash Reporting (Sentry) | Core | Static | `lib/sentry.ts` |
| 7.11 | Performance Monitoring | Common | Static | `lib/performance.ts` |
| 7.12 | Attribution Tracking | Common | Per-app | - |
| 7.13 | Cohort Analysis | Common | Server config only | - |
| 7.14 | Anonymous Event Tracking | Core | Static | - |
| 7.15 | Debug Mode Logging | Core | Static | - |
| 7.16 | Consent-Based Tracking (GDPR/ATT) | Common | Static | `components/ATTPrompt.tsx`, `components/ConsentBanner.tsx` |

**Key files:** `lib/posthog.ts`, `lib/sentry.ts`, `lib/performance.ts`, `hooks/useAnalytics.ts`

---

## 8. Push Notifications (13 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 8.1 | Permission Request (after aha moment) | Core | Static | `features.pushNotifications.permissionTiming` |
| 8.2 | Push Token Registration | Core | Static | - |
| 8.3 | Foreground Notification Handler | Core | Static | - |
| 8.4 | Notification Response (deep link) | Core | Template pattern | - |
| 8.5 | Local Notifications (scheduled) | Common | Static | `lib/notifications.ts` |
| 8.6 | Remote Notifications (Expo Push API) | Common | Template pattern | - |
| 8.7 | Android Notification Channels | Common | Template pattern | - |
| 8.8 | Rich Notifications (images, actions) | Specialized | Per-app | - |
| 8.9 | Badge Count | Common | Static | - |
| 8.10 | Notification Preferences (per-category) | Core | Template pattern | - |
| 8.11 | Quiet Hours | Specialized | Per-app | - |
| 8.12 | Notification Inbox (in-app) | Common | Static | `components/NotificationInbox.tsx` |
| 8.13 | Background Notification Processing | Specialized | Config | - |

**Key files:** `lib/notifications.ts`, `app/(tabs)/settings.tsx`

---

## 9. Security (15 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 9.1 | Secure Token Storage (keychain) | Core | Static | `lib/supabase.ts` (ExpoSecureStore) |
| 9.2 | Biometric Lock (timeout-based) | Core | Config-toggled | `features.auth.biometric` |
| 9.3 | Input Validation | Core | Template pattern | - |
| 9.4 | HTTPS Only | Core | Automatic | - |
| 9.5 | Certificate Pinning | Specialized | Per-app (finance/health) | - |
| 9.6 | Jailbreak/Root Detection | Specialized | Per-app | - |
| 9.7 | Code Obfuscation (Hermes bytecode) | Common | Automatic | - |
| 9.8 | Sensitive Data Masking (screenshots) | Common | Template pattern | - |
| 9.9 | API Key Protection (EXPO_PUBLIC only) | Core | Static | - |
| 9.10 | Rate Limiting | Common | Server-side | - |
| 9.11 | Data at Rest Encryption | Specialized | Per-app | - |
| 9.12 | Clipboard Auto-Clear | Specialized | Template pattern | - |
| 9.13 | App Transport Security | Core | Automatic | - |
| 9.14 | WebView Security | Specialized | Per-app | - |
| 9.15 | Dependency Auditing (`npm audit`) | Core | CI template | `.github/workflows/` |

**Key files:** `hooks/useAuth.ts`, `lib/supabase.ts`

---

## 10. Performance (15 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 10.1 | Cold Start Optimization (<2s) | Core | Template rules | - |
| 10.2 | Lazy Screen Loading | Core | Template pattern | - |
| 10.3 | expo-image (caching, blurhash) | Core | Static | - |
| 10.4 | List Virtualization (FlatList tuning) | Core | Template pattern | - |
| 10.5 | Memoization (memo, useMemo, useCallback) | Core | Template pattern | - |
| 10.6 | Bundle Size Monitoring | Common | CI template | - |
| 10.7 | Memory Leak Prevention | Core | Template pattern | - |
| 10.8 | Hermes Engine | Core | Automatic | - |
| 10.9 | Network Request Caching | Common | Static | `services/api.ts` (withCache) |
| 10.10 | Animation on UI Thread (Reanimated) | Common | Static | - |
| 10.11 | Image Blurhash placeholders | Common | Template component | - |
| 10.12 | Debounced Input | Core | Static hook | `hooks/useSearch.ts` |
| 10.13 | Preloading Critical Data | Common | Template pattern | - |
| 10.14 | Tree Shaking (ESM imports) | Core | Template rules | - |
| 10.15 | Font Loading Optimization | Core | Static | - |

**Key files:** `services/api.ts`, `hooks/useSearch.ts`

---

## 11. Social & Sharing (11 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 11.1 | Native Share Sheet | Core | Static | `lib/sharing.ts` |
| 11.2 | Deep Links (custom scheme) | Core | Static | `app.scheme` |
| 11.3 | Universal Links (iOS HTTPS) | Common | Template pattern | - |
| 11.4 | Android App Links | Common | Template pattern | - |
| 11.5 | Share Content Generation (view-shot) | Common | Template component | - |
| 11.6 | Referral System | Common | Per-app | - |
| 11.7 | Invite Friends | Common | Template pattern | - |
| 11.8 | Social Media Preview (OG tags) | Common | Per-app (needs web) | - |
| 11.9 | Copy to Clipboard | Core | Static | - |
| 11.10 | QR Code Generation | Specialized | Template component | - |
| 11.11 | QR Code Scanning | Specialized | Template component | - |

**Key files:** `lib/sharing.ts`

---

## 12. Search & Discovery (9 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 12.1 | In-App Search (debounced) | Common | Static | `features.search.enabled` |
| 12.2 | Full-Text Search (Supabase FTS) | Specialized | Template pattern | `features.search.implementation` |
| 12.3 | Client-Side Filter | Common | Static | - |
| 12.4 | Search History (recent queries) | Common | Static | - |
| 12.5 | Search Suggestions | Specialized | Per-app | - |
| 12.6 | Spotlight/Siri Integration (iOS) | Specialized | Per-app | - |
| 12.7 | Content Indexing (Android) | Specialized | Per-app | - |
| 12.8 | Filter & Sort UI | Common | Template components | `components/ui/SearchBar.tsx` |
| 12.9 | Faceted Search | Specialized | Per-app | - |

**Key files:** `hooks/useSearch.ts`, `components/ui/SearchBar.tsx`

---

## 13. Gamification & Engagement (12 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 13.1 | Daily Streaks | Common | Static | `features.gamification.enabled`, `components/StreakBadge.tsx` |
| 13.2 | Points System | Common | Static | `lib/gamification.ts` |
| 13.3 | Achievements / Badges | Common | Template + per-app | `features.gamification.elements` |
| 13.4 | Progress Bars | Common | Static component | `components/ui/ScoreRing.tsx` |
| 13.5 | Leaderboards | Specialized | Template pattern | - |
| 13.6 | Streak Freeze | Common | Static | - |
| 13.7 | Weekly/Monthly Challenges | Specialized | Template pattern | - |
| 13.8 | Celebration Animations (confetti) | Common | Template component | - |
| 13.9 | Daily Check-In rewards | Common | Template pattern | - |
| 13.10 | XP / Leveling System | Specialized | Per-app | - |
| 13.11 | Habit Reminders | Common | Template pattern | - |
| 13.12 | Social Comparison | Specialized | Per-app | - |

**Key files:** `lib/gamification.ts`, `components/StreakBadge.tsx`, `components/ui/ScoreRing.tsx`

---

## 14. Content & Media (15 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 14.1 | Image Picker (gallery + camera) | Common | Template component | - |
| 14.2 | Camera Capture | Specialized | Template component | - |
| 14.3 | Image Cropping/Editing | Common | Template pattern | - |
| 14.4 | File Upload to Supabase Storage | Common | Template pattern | - |
| 14.5 | Document Picker | Specialized | Template component | - |
| 14.6 | Audio Playback | Specialized | Template pattern | - |
| 14.7 | Audio Recording | Specialized | Template pattern | - |
| 14.8 | Video Playback | Specialized | Template component | - |
| 14.9 | Video Recording | Specialized | Per-app | - |
| 14.10 | Image Gallery/Lightbox (zoom) | Common | Template component | - |
| 14.11 | File Download | Specialized | Template pattern | - |
| 14.12 | Rich Text Display (markdown) | Common | Template component | - |
| 14.13 | Avatar Upload (crop + upload) | Common | Template flow | - |
| 14.14 | Media Compression before upload | Common | Template pattern | - |
| 14.15 | Cached Image Display (expo-image) | Core | Static | - |

---

## 15. Communication (8 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 15.1 | In-App Messaging | Specialized | Per-app | - |
| 15.2 | Chat UI (bubbles, timestamps) | Specialized | Template component | - |
| 15.3 | Email Composing (mailto:) | Common | Static | - |
| 15.4 | SMS Composing | Specialized | Static | - |
| 15.5 | In-App Announcements | Common | Template component | - |
| 15.6 | Comment System | Specialized | Per-app | - |
| 15.7 | Reactions/Likes | Specialized | Per-app | - |
| 15.8 | Activity Feed | Specialized | Per-app | - |

---

## 16. Settings & Preferences (15 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 16.1 | Theme Toggle | Core | Static | `features.darkMode` |
| 16.2 | Notification Preferences (per-cat) | Core | Template pattern | - |
| 16.3 | Account Management (edit profile) | Core | Template pattern | - |
| 16.4 | Sign Out | Core | Static | - |
| 16.5 | Privacy Policy Link | Core | Static | - |
| 16.6 | Terms of Service Link | Core | Static | - |
| 16.7 | Data Export (GDPR) | Core | Template pattern | `features.csvExport.enabled` |
| 16.8 | Account Deletion | Core | Static | - |
| 16.9 | App Version Display | Core | Static | - |
| 16.10 | Feature Flags (server-controlled) | Common | Template pattern | - |
| 16.11 | Language Selection (i18n) | Specialized | Template pattern | `features.i18n.enabled` |
| 16.12 | Biometric Toggle | Common | Static | - |
| 16.13 | Cache Management (clear + size) | Common | Template pattern | - |
| 16.14 | Default View Preferences | Common | Template pattern | - |
| 16.15 | Units/Format Preferences | Specialized | Per-app | - |

**Key files:** `app/(tabs)/settings.tsx`

---

## 17. Support & Feedback (11 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 17.1 | Shake-to-Report | Common | Static | `components/FeedbackButton.tsx` |
| 17.2 | In-App Feedback Button | Core | Static | `components/FeedbackButton.tsx` |
| 17.3 | In-App FAQ / Help Center | Common | Template pattern | `features.helpSystem.enabled` |
| 17.4 | NPS Survey | Common | Static | `components/NPSSurvey.tsx` |
| 17.5 | App Store Rating Prompt | Core | Static | `lib/store-review.ts` |
| 17.6 | Bug Report with Context | Common | Template pattern | - |
| 17.7 | Changelog / What's New | Common | Template component | - |
| 17.8 | Contact Support (mailto) | Core | Static | - |
| 17.9 | Onboarding Help (how-to modal) | Common | Static | `components/HowToUseModal.tsx` |
| 17.10 | Status Page Integration | Specialized | Per-app | - |
| 17.11 | Screenshot Attachment | Common | Template pattern | - |

**Key files:** `components/FeedbackButton.tsx`, `components/NPSSurvey.tsx`, `components/HelpButton.tsx`, `components/HelpSheet.tsx`, `components/HowToUseModal.tsx`, `lib/store-review.ts`

---

## 18. Compliance & Privacy (13 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 18.1 | App Tracking Transparency (ATT) | Core | Static | `components/ATTPrompt.tsx` |
| 18.2 | GDPR Consent Banner | Common | Static | `components/ConsentBanner.tsx` |
| 18.3 | CCPA Notice | Common | Static | `components/ConsentBanner.tsx` |
| 18.4 | Data Export (Right of Access) | Core | Template pattern | - |
| 18.5 | Account Deletion (Right to Erasure) | Core | Static | - |
| 18.6 | Privacy Policy (in-app) | Core | Static | - |
| 18.7 | Terms of Service | Core | Static | - |
| 18.8 | Consent Logging (audit trail) | Common | Static | `components/ConsentBanner.tsx` (logs to `consent_log` table) |
| 18.9 | Age Gate (COPPA) | Specialized | Template pattern | - |
| 18.10 | Data Retention Policy | Common | Server-side | - |
| 18.11 | Third-Party Data Disclosure | Core | Per-app documentation | - |
| 18.12 | Right to Rectification (edit data) | Core | Template pattern | - |
| 18.13 | Data Processing Agreement | Specialized | Legal document | - |

---

## 19. QA & Testing (14 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 19.1 | Smoke Tests (business logic) | Core | Static | `__tests__/smoke.test.ts` |
| 19.2 | Unit Tests (functions, hooks) | Core | Template pattern | - |
| 19.3 | Component Tests | Common | Template pattern | - |
| 19.4 | Integration Tests (flows) | Common | Template pattern | - |
| 19.5 | End-to-End Tests (Maestro) | Specialized | Per-app | - |
| 19.6 | Type Checking (`tsc --noEmit`) | Core | Static | `scripts/release.mjs` |
| 19.7 | Linting (ESLint) | Core | Static config | - |
| 19.8 | Crash Monitoring (Sentry) | Core | Static | - |
| 19.9 | Pre-Release Gate (script) | Core | Static | `scripts/release.mjs` |
| 19.10 | Pre-Build Audit (crash patterns) | Core | Template pattern | - |
| 19.11 | Visual Regression Testing | Specialized | Per-app | - |
| 19.12 | Performance Testing | Common | Template pattern | - |
| 19.13 | Accessibility Testing (a11y queries) | Common | Template pattern | - |
| 19.14 | Mock Supabase Client | Core | Static | - |

**Key files:** `__tests__/smoke.test.ts`, `scripts/release.mjs`

---

## 20. CI/CD & DevOps (15 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 20.1 | EAS Build Configuration | Core | Static | `eas.json` |
| 20.2 | GitHub Actions CI (lint+type+test) | Core | Static | `.github/workflows/` |
| 20.3 | EAS Build on Push | Common | Static | - |
| 20.4 | OTA Updates (expo-updates) | Core | Static | - |
| 20.5 | OTA Auto-Check on launch | Core | Static | `app/_layout.tsx` |
| 20.6 | Release Script | Core | Static | `scripts/release.mjs` |
| 20.7 | Environment Variables (EAS) | Core | Static | `.env.example` |
| 20.8 | App Store Submission (eas submit) | Common | Config per app | - |
| 20.9 | Feature Flags (PostHog) | Common | Template pattern | - |
| 20.10 | A/B Testing Infrastructure | Common | Template pattern | - |
| 20.11 | Staged Rollout (% of users) | Common | Config per app | - |
| 20.12 | Rollback Capability | Core | Operational | - |
| 20.13 | Build Notifications (Slack/Discord) | Common | Per-app | - |
| 20.14 | Dependency Updates (Dependabot) | Common | Static | `.github/dependabot.yml` |
| 20.15 | Runtime Version Policy | Core | Static | `app.config.js` |

**Key files:** `eas.json`, `app.config.js`, `scripts/release.mjs`

---

## 21. Localization (10 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 21.1 | i18n Framework (i18next) | Common | Static | `features.i18n.enabled` |
| 21.2 | Locale Detection | Core | Static | - |
| 21.3 | String Externalization (locales/*.json) | Common | Template pattern | `locales/` |
| 21.4 | RTL Support | Specialized | Template pattern | - |
| 21.5 | Date/Time Formatting (Intl) | Core | Static | - |
| 21.6 | Number Formatting (Intl) | Core | Static | - |
| 21.7 | Currency Formatting | Common | Static | - |
| 21.8 | Pluralization | Common | Template pattern | - |
| 21.9 | Language Switcher (Settings) | Specialized | Template pattern | - |
| 21.10 | Translation Management | Specialized | Per-app | - |

**Key files:** `lib/i18n.ts`, `locales/en.json`

---

## 22. Device & Platform (20 features)

| # | Feature | Tier | Status | Config Key |
|---|---------|------|--------|------------|
| 22.1 | Camera Permission | Common | Template pattern | - |
| 22.2 | Photo Library Permission | Common | Template pattern | - |
| 22.3 | Location Permission | Specialized | Per-app | - |
| 22.4 | Notification Permission | Core | Static | - |
| 22.5 | Contacts Permission | Specialized | Per-app | - |
| 22.6 | Calendar Permission | Specialized | Per-app | - |
| 22.7 | Background Fetch | Specialized | Template pattern | - |
| 22.8 | Background Location | Specialized | Per-app | - |
| 22.9 | Home Screen Widgets | Specialized | Per-app | - |
| 22.10 | App Shortcuts / Quick Actions | Specialized | Per-app | - |
| 22.11 | Haptic Engine | Common | Static | - |
| 22.12 | Device Info | Core | Static | - |
| 22.13 | Network Type Detection | Common | Static | - |
| 22.14 | Battery Awareness | Specialized | Per-app | - |
| 22.15 | Screen Orientation lock | Core | Static | - |
| 22.16 | App State Management (fg/bg) | Core | Static | - |
| 22.17 | Handoff (iOS) | Specialized | Per-app | - |
| 22.18 | Clipboard Access | Common | Static | - |
| 22.19 | Share Extension | Specialized | Per-app | - |
| 22.20 | Keep-Awake (timer/media apps) | Specialized | Template pattern | - |

---

## Async Backbone

- **Job queue** - DB-backed queue with exponential backoff retry. Used for any work too long for an Edge Function or needing scheduling.
- **Scheduled jobs** - pg_cron + Edge Function pattern. Used for digests, retention purges, periodic syncs.
- **Server-side push** - Send pushes from backend to all of a user's devices via Expo Push. Batches by 100. Cleans invalid tokens automatically.
- **Transactional email** - Send templated emails (welcome, password reset, receipt) via Resend. Every send logged.
- **Server-side rate limiting** - Token bucket per scope+key. Use in Edge Functions to throttle abuse.
- **Webhook receiver template** - Copy-and-customize template that verifies HMAC (with prefix support for GitHub/Slack/Stripe), dedupes via idempotency_keys, enqueues for processing.
- **Outbound webhook dispatch** - Queue and deliver webhooks to third parties with retry and timestamped HMAC signing.

## Compliance, Data Rights, Observability, Cost

- **Audit log** - append-only log of writes to sensitive tables + auth events + admin actions. Indexed by actor, target, action. SOC 2 baseline; HIPAA-overlay-friendly via pii_class column.
- **Account deletion lifecycle** - configurable grace window (default 30d), recovery flow on login, immediate-delete option, daily purge cron, audit trail in account_deletion_log.
- **GDPR data export** - user-initiated; background-built gzipped JSON in Storage; 7-day signed URL emailed.
- **Retention engine** - generalized retention_policies table; nightly scheduled cleanup; per-policy isolation (one bad policy doesn't break the rest).
- **Cost guardrails** - per-(scope,key,period) budgets with 3 enforcement modes: throttle (graceful via cluster-1 rate limiter), block (refuse), alert_only (record + audit).
- **Sentry observability** - every Edge Function reports errors and performance traces; cluster-1 reportException stub now wired to Sentry; no-op fallback when DSN unset.
- **iOS PrivacyInfo manifest** - generated from gas.config.privacy at prebuild; covers data categories, tracking domains, ATT description.
- **App Tracking Transparency helper** - requestATTOnce / getATTStatus; iOS-only; configurable trigger event.
- **Web privacy consent banner** - EU-detected (Cloudflare header → GeoIP → require-everywhere); 3 actions; persists to localStorage + consent_log.
- **PITR + restore drill** - operator runbook for enabling Point-in-Time Recovery and quarterly drill cadence.

## Media, Search, Realtime, Integrations (cluster 4)

- **image_pipeline** - `services/media.ts` `pickImage()` + `uploadImage()` flow. Expo Image Picker wrapped with permission checks and cancellation; uploads to Supabase Storage with content-type detection. `MediaError` discriminated by `code` so callers handle `cancelled` separately from `permission_denied`.
- **signed_urls** - `signedUrlFor(bucket, path, ttlSeconds)` mints time-limited URLs for private storage objects. Default TTL configurable in `gas.config.media`. Use for avatars, user uploads, anything not in a public bucket.
- **postgres_fts** - `search_with_rank` SQL helper in migration 010 + `services/search.ts` `search<T>()`. Wraps `to_tsquery` + `ts_rank_cd`; works against any table with a `tsvector` column. Returns `SearchResult<T>[]` with rank scores so callers can sort or filter.
- **realtime_presence** - `usePresence(channel, meta)` hook in `services/realtime.ts`. Tracks peers in a Supabase Realtime channel with join/leave events; auto-cleans on unmount. Useful for "who's viewing" indicators, multi-cursor, live counts.
- **realtime_broadcast** - `broadcast(channel, event, payload)` server-fanout helper + `useSubscription(channel, event, handler)` client hook. One sender, many listeners; payload is arbitrary JSON. Use for cross-device notifications, live dashboards, chat.
- **optimistic_mutation** - `hooks/useOptimisticMutation.ts`. Generic primitive: pair a `(args) => Promise<result>` mutation with a local state reducer; hook applies the optimistic state immediately and rolls back on failure. Replaces ad-hoc try/catch + setState patterns.
- **oauth_connections** - `oauth_connections` table in migration 010 with `pgsodium`-encrypted token columns. `services/oauth.ts` exposes `getActiveAccessToken` (auto-refreshes within 60s of expiry), `listConnections`, `disconnectProvider`. Connection persistence is server-side only: operators implement a per-provider OAuth callback Edge Function that invokes admin-gated `oauth-save-connection` server-to-server. Service-role-only access; tokens never leave the server.
- **oauth_save_endpoint** - `oauth-save-connection` Edge Function (admin-gated). Encrypts incoming tokens via RPC before insert. Called by server-side OAuth callback handlers (per-app).
- **oauth_get_endpoint** - `oauth-get-token` Edge Function (user-auth-gated). Returns the active decrypted access token for the calling user; enqueues a refresh job if the token is stale.
- **oauth_refresh_dispatcher** - `oauth-refresh` Edge Function (job-dispatched). Operator-implemented per-provider refresh stubs; DevAgent wires the provider-specific refresh URL + body for whichever integrations the app uses.
- **maestro_e2e** - `.maestro/` directory with starter flows (auth, smoke nav). Local via `maestro test .maestro/`; CI via Maestro Cloud (opt-in `MAESTRO_API_KEY` secret).
- **e2e_workflow** - `.github/workflows/maestro.yml` (or equivalent) runs the `.maestro/` flows on PR open. Skips gracefully when `MAESTRO_API_KEY` is absent.
- **storage_bucket_setup_script** - `scripts/setup-storage-buckets.sql`. Idempotent bucket creation + RLS policies for `avatars/`, `user-uploads/`, `public-media/`. Run once per Supabase project; safe to re-run after schema changes.

## LLM, Lifecycle, Multi-tenancy, Growth, Admin, Accessibility (cluster 5)

- **llm_client** - `services/llm.ts` exposes provider-agnostic `chat()`, `streamChat()`, `embed()`, `transcribe()` with `ChatMessage` / `ChatOptions` / `ChatCompletion` types.
  - OpenAI adapter (`lib/llm-adapters/openai.ts`) covers chat, streaming, embeddings, transcribe (Whisper).
  - Anthropic adapter (`lib/llm-adapters/anthropic.ts`) covers chat + streaming; embed/transcribe throw `unsupported_capability` so callers can fall back to a second provider.
  - Every call routes through `consume_cost` RPC keyed by `gas.config.llm.costScope` - cluster-2 cost budgets apply automatically (throttle / block / alert_only).
- **a11y_lint** - `.github/workflows/a11y.yml` runs `npm run lint` with `eslint-plugin-react-native-a11y` enabled. ZERO errors required; the ~200 existing warnings are surfaced for incremental cleanup, not blocking merges.
- **a11y_maestro_flow** - `.maestro/a11y.yaml` walks the app with VoiceOver/TalkBack enabled and asserts every screen has accessible labels. Runs in the same CI pipeline as the rest of the Maestro flows.
- **dynamic_type** - `hooks/useDynamicType()` returns the system font scale (iOS Dynamic Type, Android font scale). Components multiply their base font size by the scale so user accessibility settings take effect.
- **reduced_motion** - `hooks/useReducedMotion()` observes the system "reduce motion" toggle. Animation primitives short-circuit to instant transitions when true.
- **apple_signin** - `services/apple-auth.ts` exposes `isAppleAuthAvailable()` + `signInWithApple()` (expo-apple-authentication wrapper). Returns `{ userId, email }` on success; throws on cancel.
- **biometric_auth** - `services/biometric.ts` - `isBiometricAvailable()`, `authenticate(reason)` (re-exported as `authenticateBiometric`), `requiresReauth()` (configurable max-age policy). Wraps expo-local-authentication.
- **breakpoint_hook** - `hooks/useBreakpoint()` returns `'phone' | 'tablet' | 'desktop'` based on window width. Recomputes on rotation/resize so responsive layouts stay correct without manual listeners.
- **orientation_hook** - `hooks/useOrientation()` returns `'portrait' | 'landscape'`. Useful for media players, camera surfaces, and layout swaps.
- **onboarding_scaffold** - `components/Onboarding/` directory: `OnboardingProvider`, `OnboardingStep`, `OnboardingControls`, barrel export. Pluggable multi-step onboarding with built-in step counter, skip, and persistence; app provides the step content.
- **paywall** - `components/Paywall.tsx`. Config-driven paywall surface that reads pricing/copy from `gas.config.monetization` and wires the purchase flow through `useSubscription`.
- **subscription_manager** - `components/SubscriptionManager.tsx`. Manage / cancel / restore screen - single component that handles all four states (none, trialing, active, expired) plus restore-purchases.
- **virtual_list** - `components/VirtualList.tsx`. Virtualized list wrapper with a FlashList-compatible API. Use for any list expected to exceed ~100 items.
- **admin_route_group** - `app/(admin)/` route group. Gated by `requireAdmin()` from `lib/admin.ts`; unauthorized users redirect to the home tab. Enable via `gas.config.admin.enabled`.
- **admin_users_screen** - `app/(admin)/users.tsx`. List users, search by email, view profile + role, promote/demote (server-side via admin-gated edge function).
- **admin_support_screen** - `app/(admin)/support.tsx`. Read every `feedback_thread` (RLS opens for admin role), respond inline, update status/priority.
- **admin_payments_screen** - `app/(admin)/payments.tsx`. View recent transactions, issue refunds (per-store deep link), audit-log every action.
- **admin_flags_screen** - `app/(admin)/flags.tsx`. CRUD for `feature_flags` table from inside the app - operator doesn't need SQL access for rollout bumps or kill-switch flips.
- **multitenancy_optin** - `gas.config.multiTenancy.enabled` flag. When true, `lib/multitenancy.tsx` mounts `<OrgProvider>` and feature code uses `orgFilter(query, currentOrgId)` to scope queries. Backed by `organizations` + `organization_members` tables and the `user_org_ids()` SECURITY DEFINER helper (avoids 42P17 RLS recursion).
- **referrals** - `referrals` table + `services/referrals.ts` (`recordAttribution`, `listMyReferrals`). Codes are generated client-side via `generateReferralCode()` and attributed server-side on the referred user's first matching event (signup, purchase, etc.).
- **share_helper** - `services/share.ts` `share({ code, subject, message, url? })`. Cross-platform native share sheet wrapper; returns `{ shared: boolean }` so analytics can track open vs. complete.
- **events_catalog** - `lib/events.ts` exports a central `EVENTS` const and `EventName` union type. Every analytics call references an event name from one place so renames are atomic and grepping for usages is reliable.
- **experiments** - `experiments` table + `hooks/useExperiment(name, variants)`. Deterministic per-user bucketing; assignment persists across sessions via the table so cohort analysis is stable. Variant names are arbitrary strings supplied by the caller.
- **background_sync** - `hooks/useBackgroundSync(opts)` periodic sync helper with foreground/background awareness. Replaces ad-hoc `setInterval` + `AppState` listeners in app code; auto-cleans on unmount.
- **i18n_extraction** - `scripts/extract-i18n-keys.mjs`. Scans `t('…')` call sites and writes any missing keys into every `locales/<lang>.json` file. Run after adding new `t()` calls; commit the updated locales alongside the code.
- **rtl_maestro_flow** - `.maestro/rtl.yaml`. Flips the device to an RTL locale and asserts layout doesn't regress (chevrons flip, padding stays balanced, no clipped text).
- **conflict_resolution_doc** - `docs/CONFLICT_RESOLUTION.md`. Reference patterns for offline + multi-device writes: last-write-wins, merge-on-conflict, version-vector. Pick once per table; documented so DevAgent picks consistently.

## Mobile Template Completeness (cluster 6)

- **push_notifications** - `services/push.ts` + `supabase/functions/send_push/`. End-to-end push delivery: lazy permission prompt via `requestPermission()`, token registration to `push_tokens` table, server-side fan-out via Expo Push API (batches per 100), auto-delete of `DeviceNotRegistered` tokens, audit_log write per delivery. Three categories: `transactional`, `product`, `marketing` (marketing off by default). Config key: `gasConfig.features.notifications`.
- **push_permissions_hook** - `hooks/usePushPermissions.ts`. Tracks permission status (`granted` / `denied` / `undetermined`) and exposes a `request()` trigger. Use this rather than calling `requestPermission()` directly so permission state is reactive.
- **ota_channels** - `eas.json` profiles for `preview`, `staging`, and `production` EAS Update channels. Config keys: `gasConfig.app.minRuntimeVersion`, `gasConfig.app.updateBranch`. Rollback documented in `docs/RELEASE_CHANNELS.md`.
- **min_version_gate** - `components/MinVersionGate.tsx`. Wraps the app tree and renders a blocking update prompt when `Updates.runtimeVersion` is below `gasConfig.app.minRuntimeVersion`. Uses the `lib/semver.ts` comparator from cluster 3. Config-toggled.
- **anonymous_auth** - `services/auth.ts` additions: `signInAnonymously()` wraps `supabase.auth.signInAnonymously`; `upgradeAnonymousAccount()` rejects with `{ conflictWith }` when the email is already taken. `supabase/functions/migrate_anonymous_data/` handles server-side row migration in a transaction with rollback. Audited in `anonymous_migrations` table. Config key: `gasConfig.features.anonymousAuth.enabled`.
- **anonymous_migration_hook** -- `hooks/useAnonymousMigration.ts`. Tracks migration state (idle / migrating / done / error) and exposes a `migrate(email, password)` trigger. Reads table list from `gasConfig.features.anonymousAuth.tables`.
- **visual_regression** -- `.github/workflows/visual.yml` + `chromaui/action@v11`. Runs on PRs touching `components/_primitives/**`, `.storybook/**`, or `package.json`. Uses `onlyChanged` to stay within the 5k snapshot/mo free tier. Baseline approval in the Chromatic UI. Config: `CHROMATIC_PROJECT_TOKEN` secret. Documented in `docs/VISUAL_REGRESSION.md`.
- **form_library** -- `lib/forms.ts`. `useTypedForm<TSchema>` typed wrapper with `zodResolver` + `mode:onBlur`; `useFormServerError` reads `root.serverError` from react-hook-form; `useAsyncFieldValidator` returns `{ isValidating, error }` for debounced remote validation. Template pattern; DevAgent uses these hooks when generating forms.
- **form_primitives** -- `components/forms/` directory: `FormInput`, `FormSelect`, `FormTextarea`, `FormCheckbox`, `FormSwitch`, `FormButton`, `FormErrorBanner`. All wired to react-hook-form `Controller` with `accessibilityLabel` and `accessibilityRole="alert"` on error state. Static.
- **store_metadata** -- `store.config.json` (App Store + Play Store metadata with `{{placeholder}}` tokens) + `scripts/submit-store.mjs` (wraps `eas submit` and `eas metadata:push`). `npm run submit:store -- --platform all`. Documented in `docs/STORE_METADATA.md`. Config-toggled via `--dry-run` flag.
- **crash_free_slo** -- `scripts/check-crash-free-slo.mjs` + `.github/workflows/slo-gate.yml`. Queries Sentry Sessions API for the 24 h crash-free rate; blocks the production EAS submit job when rate is below `gasConfig.slo.crashFreeTarget` (default 99.5%). Documented in `docs/CRASH_FREE_SLO.md`.
- **appstate_hook** -- `hooks/useAppState.ts`. Returns current `AppStateStatus` and updates on every transition. Thin wrapper around the React Native `AppState` API that handles listener cleanup.
- **foreground_hook** -- `hooks/useOnForeground.ts`. Fires a stable callback each time the app moves from background to active. Deps array mirrors `useEffect` semantics.
- **background_hook** -- `hooks/useOnBackground.ts`. Fires a stable callback each time the app moves from active to background. Deps array mirrors `useEffect` semantics.
- **widget_scaffold** -- `modules/widget/` Expo Module with iOS WidgetKit extension and Android AppWidgetProvider scaffold. `services/widget-data.ts` exposes `setWidgetData(key, value)` and `getWidgetData(key)` for reading/writing the shared App Group container. Documented in `docs/WIDGETS.md`. Template pattern; DevAgent adapts the widget UI and data shape per app.
- **i18n_coverage_ci** -- `.github/workflows/i18n-coverage.yml` + `scripts/check-i18n-coverage.mjs`. Detects untranslated keys on every PR and opens an automated PR with the missing keys pre-filled (English value as placeholder for non-English locales). No operator setup required.

## Native Visual Regression, Push Receipts, Screenshot Automation, Per-Platform SLO, Typed Widget Data, FormWizard (cluster 7)

- **push_receipt_polling** - `supabase/functions/check_push_receipts/` Edge Function. Polls Expo getReceipts API on a 5-minute cron for all `pending` rows in `push_deliveries`. Settles rows to `ok` / `error` / `expired`. Deletes `push_tokens` rows on `DeviceNotRegistered`. `send_push` writes a `push_deliveries` row per ticket after dispatch. Configurable via `gasConfig.features.notifications.receiptPolling`. Documented in `docs/PUSH_RECEIPTS.md`. Status: Config-toggled.
- **screenshot_automation** - `.maestro/screenshots/` with five flow YAMLs (home, signup, paywall, profile, settings) + `scripts/generate-screenshots.mjs` that captures via Maestro and resizes via Sharp to all required App Store and Play Store sizes. Output: `screenshots/{platform}/{size}/{order}-{name}.png`. `pnpm screenshots` runs locally; `.github/workflows/screenshots.yml` via workflow_dispatch. Documented in `docs/SCREENSHOTS.md`. Status: Template pattern.
- **per_platform_slo** - `gasConfig.monitoring.crashFreeThresholds[env]` extended to accept `number | { ios: number; android: number }`. `scripts/crash-free-helpers.ts` exports `checkPerPlatform` which queries Sentry per platform and fails when any platform falls below its floor. Defaults: `production = { ios: 99.5, android: 99.0 }`, `staging = 95.0`. Documented in `docs/CRASH_FREE_SLO.md`. Status: Config-toggled.
- **typed_widget_codec** - `services/widget-data.ts` extended with `setWidgetData<T>` / `getWidgetData<T>` supporting `string | number | boolean | object | array` via a sentinel envelope `{ __t, v }`. Legacy raw string reads auto-detected. 32 KB warn / 64 KB reject size guards. Documented in `docs/WIDGETS.md`. Status: Static.
- **form_wizard** - `components/forms/FormWizard.tsx`. Multi-step form component with per-step zod validation, progress header (Step N of M + bar), controlled and uncontrolled modes. Accepts `schema`, `steps`, `defaultValues`, `onComplete`, optional `form` prop. Step transitions announced via `accessibilityLiveRegion="polite"`. Re-exported from `services/api`. Documented in `docs/FORMS.md`. Status: Static.

## Resilience and Release Safety (cluster 3)

- **Feature flags** - `feature_flags` table + `useFlag(key)` hook. Each row carries `enabled`, `rollout_percentage`, `segments` (jsonb). Hook polls every 60s and hashes userId for deterministic rollout buckets.
- **Kill switch** - special `kill_<feature>` flag keys. `useFlag('kill_<feature>')` returns true when the kill is active; guard production features behind the inverted check. Propagates under 60s.
- **Min-version gate** - `app_versions` table + cold-start check in `MinVersionContext`. Renders `<UpdateRequired />` and stops the app when the client is below `min_version`. Deep-links to `releaseChannels.storeUrl`.
- **OTA rollout** - `rollout_percentage` on every flag enables canary → 10% → 50% → 100% without new EAS publishes between bumps. Bucket is stable per user across reloads.
- **Schema versioning** - every new table adds `schema_version int default 1`. Breaking changes bump the column, emit audit-log warnings to old callers, and run two releases in parallel before cleanup. See `docs/SCHEMA_VERSIONING.md`.
- **Security scanning** - `.github/workflows/security.yml` runs npm audit (high+), Semgrep, gitleaks, license-checker, bundle-size on every PR. Local reproduction via `npm run security`.
- **EAS preview per PR** - `.github/workflows/eas-preview.yml` publishes a `pr-{number}` EAS Update channel and comments the preview URL. Opt-in via `EAS_TOKEN` secret.
- **Performance budget** - `gas.config.performance.maxBundleSizeMB` + `coldStartTargetMs`. `npm run check-bundle` gates PRs against the bundle ceiling.
- **Storybook** - Storybook 8 web-only via Vite + React Native Web. `npm run storybook` for dev, `npm run build-storybook` for static export.
- **Supabase codegen** - `npm run gen-types` regenerates `types/database.ts` from the linked Supabase project. Husky pre-commit auto-runs when a migration is staged.
- **Release notes pipeline** - per-version markdown files in `release-notes/v{semver}.md`. `npm run check-release-notes` fails CI when the file for the current version is missing. `eas submit` reads it as the App Store / Play Store "what's new" text.

---

## Summary

| Category | Total | Static/Template | Per-App |
|----------|-------|-----------------|---------|
| 1. Auth & Identity | 18 | 15 | 3 |
| 2. Onboarding | 11 | 8 | 3 |
| 3. Navigation & Layout | 18 | 16 | 2 |
| 4. UI/UX Foundation | 22 | 20 | 2 |
| 5. Data & Backend | 18 | 15 | 3 |
| 6. Monetization | 16 | 13 | 3 |
| 7. Analytics & Tracking | 16 | 13 | 3 |
| 8. Push Notifications | 13 | 10 | 3 |
| 9. Security | 15 | 9 | 6 |
| 10. Performance | 15 | 14 | 1 |
| 11. Social & Sharing | 11 | 8 | 3 |
| 12. Search & Discovery | 9 | 6 | 3 |
| 13. Gamification | 12 | 9 | 3 |
| 14. Content & Media | 15 | 11 | 4 |
| 15. Communication | 8 | 4 | 4 |
| 16. Settings & Preferences | 15 | 13 | 2 |
| 17. Support & Feedback | 11 | 9 | 2 |
| 18. Compliance & Privacy | 13 | 10 | 3 |
| 19. QA & Testing | 14 | 11 | 3 |
| 20. CI/CD & DevOps | 15 | 13 | 2 |
| 21. Localization | 10 | 8 | 2 |
| 22. Device & Platform | 20 | 12 | 8 |
| **TOTALS** | **246** | **187 (76%)** | **59 (24%)** |
