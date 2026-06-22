/**
 * GAS Template, Sentry Crash Reporting
 *
 * Null-safe Sentry initialization following the same pattern as posthog.ts.
 * If the DSN is missing (not configured), all exports become safe no-ops.
 *
 * Features:
 * - Null-safe: guards against empty DSN to prevent init errors
 * - User context enrichment (subscription tier, app version, device)
 * - Breadcrumb helpers for UI, API, auth, and navigation events
 * - Transaction/span support for performance monitoring
 * - Source maps configured for EAS builds
 *
 * Config: reads DSN from EXPO_PUBLIC_SENTRY_DSN env var.
 * Feature flag: gasConfig.features.analytics.crashReporting controls enablement.
 *
 * Dependencies: @sentry/react-native
 */

import * as Sentry from '@sentry/react-native';
import { gasConfig } from '../gas.config';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const isEnabled = gasConfig.features.analytics.crashReporting && !!dsn;

const SENSITIVE_KEYS = /password|token|secret|key|authorization|cookie|credential|apiKey|api_key|authToken|auth_token|access_code|private_key|client_secret/i;

export function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    sanitized[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : v;
  }
  return sanitized;
}

// Initialize Sentry only when DSN is provided AND crash reporting is enabled
if (isEnabled) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
    enableAutoSessionTracking: true,
    attachStacktrace: true,
    // Never let the SDK auto-attach PII (IP address, request headers, cookies).
    sendDefaultPii: false,
    beforeSend(event) {
      // Reduce noise: drop network errors that originated from offline sync.
      if (
        event.exception?.values?.some(v => v.type === 'TypeError' && v.value?.includes('Network request failed')) &&
        event.breadcrumbs?.some(b => b.category === 'offline')
      ) {
        return null;
      }
      // Strip PII from the user context: keep only a non-identifying id, never an
      // email / username / IP. Defense in depth even though setUser no longer sets them.
      if (event.user) {
        event.user = { id: event.user.id };
      }
      // Scrub sensitive keys from any request body the SDK captured.
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = sanitizeData(event.request.data as Record<string, unknown>);
      }
      return event;
    },
  });
}

/**
 * Capture an exception with optional context.
 * No-op if Sentry is not initialized.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!isEnabled) return;
  if (context) {
    Sentry.withScope(scope => {
      Object.entries(sanitizeData(context)).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture a message with severity level.
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
): void {
  if (!isEnabled) return;
  Sentry.captureMessage(message, level);
}

/**
 * Set the current user context for Sentry.
 * Call after login/signup. Associates crash reports with a NON-PII user id only, 
 * the email is intentionally never sent to Sentry (it is PII). The `email` param is
 * accepted for call-site compatibility but deliberately not forwarded.
 */
export function setUser(
  userId: string,
  _email?: string,
  subscriptionTier?: string
): void {
  if (!isEnabled) return;
  // Only the opaque user id, no email, username, or IP.
  Sentry.setUser({ id: userId });
  if (subscriptionTier) {
    Sentry.setTag('subscription_tier', subscriptionTier);
  }
  Sentry.setTag('app_slug', gasConfig.app.slug);
  Sentry.setTag('app_version', gasConfig.app.version);
}

/**
 * Clear the current user context. Call on logout.
 */
export function clearUser(): void {
  if (!isEnabled) return;
  Sentry.setUser(null);
}

/**
 * Add a breadcrumb for debugging context in crash reports.
 *
 * @param category - 'ui' | 'api' | 'auth' | 'navigation' | 'offline' | 'purchase'
 * @param message - Human-readable description
 * @param data - Optional key-value data
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isEnabled) return;
  Sentry.addBreadcrumb({
    category,
    message,
    data: (data ? sanitizeData(data) : undefined) as Record<string, string>,
    level: 'info',
  });
}

/**
 * Initialize Sentry. Called at module level in _layout.tsx.
 * Since Sentry.init runs at module load time above, this is a
 * named export to make the intent explicit in _layout.tsx.
 */
export function initSentry(): void {
  // Sentry.init() already runs at module load time above.
  // This function exists so _layout.tsx can explicitly import it
  // to ensure this module is loaded early.
}

/**
 * Sentry ErrorBoundary component for wrapping the app root.
 * Re-exported for convenience in _layout.tsx.
 */
export const SentryErrorBoundary = isEnabled ? Sentry.ErrorBoundary : null;
