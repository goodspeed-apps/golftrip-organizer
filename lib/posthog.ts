/**
 * GAS Template, PostHog Analytics (Consent-Aware)
 *
 * GDPR-compliant lazy PostHog initialization. The PostHog client is NOT
 * instantiated at module load time. Instead, getPostHog() creates it on
 * first call, but only if analytics consent has been granted.
 *
 * This ensures no tracking occurs before the ConsentBanner is shown and
 * the user has opted in (or GDPR consent is not required by config).
 *
 * Config: reads posthog apiKey and host from gasConfig.backend.posthog.
 * Feature flag: gasConfig.features.analytics.enabled controls whether
 * analytics should be active, but this module additionally guards against
 * missing credentials at runtime.
 *
 * Dependencies: posthog-react-native
 */

import PostHog from 'posthog-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gasConfig } from '../gas.config';
import { sanitizeData } from './sentry';

/** Analytics properties, accepts any JSON-serializable values */
type AnalyticsProperties = Record<string, unknown>;

/** Sanitize and cast to PostHog-compatible properties */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sanitize = (props: AnalyticsProperties): any => sanitizeData(props);

const apiKey = gasConfig.backend.posthog.apiKey;
const host = gasConfig.backend.posthog.host;

// ─── Lazy, consent-aware singleton ──────────────────────────────────────────

let _posthog: PostHog | null = null;
let _consentChecked = false;
let _consentGranted = false;

const CONSENT_KEY = `@${gasConfig.app.slug}:consent`;

/**
 * Synchronously check if we have cached consent state.
 * Called internally before creating the PostHog instance.
 * The first call is async (reads AsyncStorage), subsequent calls use cache.
 */
export async function checkAnalyticsConsent(): Promise<boolean> {
  if (_consentChecked) return _consentGranted;

  // If GDPR consent is not required by config, consent is implied
  if (!gasConfig.features.compliance.gdprConsent) {
    _consentChecked = true;
    _consentGranted = true;
    return true;
  }

try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    if (raw) {
      const consent = JSON.parse(raw);
      _consentGranted = consent.analytics === true;
    } else {
      // GDPR consent IS required (checked above) and the user has not chosen yet, 
      // opt-in posture: do NOT track until they explicitly grant consent. (Tracking
      // before the ConsentBanner is answered is a GDPR violation.)
      _consentGranted = false;
    }
  } catch {
    // Fail CLOSED: if consent state can't be read, do not track.
    _consentGranted = false;
  }

  _consentChecked = true;
  return _consentGranted;
}

/**
 * Get the PostHog client, creating it lazily if consent is granted.
 *
 * Returns null if:
 * - analytics is disabled in config
 * - API key is missing
 * - analytics consent has not been granted (GDPR)
 */
export async function getPostHog(): Promise<PostHog | null> {
  if (!gasConfig.features.analytics.enabled || !apiKey) return null;

  const hasConsent = await checkAnalyticsConsent();
  if (!hasConsent) return null;

  if (!_posthog) {
    _posthog = new PostHog(apiKey, { host });

    // Shared-project analytics: this app reports into a PostHog project shared by
    // every Goodspeed-hosted app, so tag every event with this app's id (+ slug)
    // as super-properties. Goodspeed's growth engine and the app's own Growth
    // screens read the shared project filtered to `app_id`. See
    // docs/design/shared-project-analytics.md in the studio repo.
    const appId = process.env.EXPO_PUBLIC_GOODSPEED_APP_ID ?? '';
    const superProps: Record<string, string> = { app_slug: gasConfig.app.slug };
    if (appId) superProps.app_id = appId;
    _posthog.register(superProps);
    // Also associate events with an 'app' group so native PostHog Group Analytics
    // can be switched on later at no extra cost.
    if (appId) _posthog.group('app', appId);

    // Enable session recording if configured (requires posthog-react-native v3.1+)
    if (gasConfig.features.analytics.sessionRecording) {
      _posthog.register({ $session_recording_enabled: true });
    }
  }

  return _posthog;
}

/**
 * Synchronous accessor for code paths that already hold a reference.
 * Returns null if PostHog has not been initialized yet.
 * Prefer getPostHog() for new code.
 */
export function getPostHogSync(): PostHog | null {
  return _posthog;
}

/**
 * Notify the analytics module that consent state has changed.
 * Call this from ConsentBanner after the user makes a choice.
 *
 * If consent was revoked, the PostHog client is shut down and cleared.
 * If consent was granted, the next getPostHog() call will create the client.
 */
export function onConsentChanged(analyticsConsented: boolean): void {
  _consentChecked = true;
  _consentGranted = analyticsConsented;

  if (!analyticsConsented && _posthog) {
    // User revoked consent, shut down PostHog
    _posthog.reset();
    _posthog = null;
  }
}

// ─── Backward-compatible named export ───────────────────────────────────────

/**
 * Backward compat: `posthog` export for existing code that reads it directly.
 * WARNING: This is always null at module load time under the new lazy model.
 * Prefer getPostHog() or the helper functions below.
 *
 * @deprecated Use getPostHog() instead.
 */
export const posthog: PostHog | null = null;

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Associate the current user with a PostHog distinct ID.
 * Call after login / signup.
 */
export async function identifyPostHogUser(
  userId: string,
  traits?: AnalyticsProperties
): Promise<void> {
  const ph = await getPostHog();
  if (!ph) return;
  ph.identify(userId, traits ? sanitize(traits) : undefined);
}

/**
 * Clear the current user's identity. Call on logout.
 */
export async function resetPostHogUser(): Promise<void> {
  const ph = await getPostHog();
  if (!ph) return;
  ph.reset();
}

/**
 * Capture a custom analytics event.
 */
export async function captureEvent(
  event: string,
  properties?: AnalyticsProperties
): Promise<void> {
  const ph = await getPostHog();
  if (!ph) return;
  ph.capture(event, properties ? sanitize(properties) : undefined);
}
