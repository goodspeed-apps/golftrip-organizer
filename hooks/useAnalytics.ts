/**
 * GAS Template, useAnalytics Hook
 *
 * Thin wrapper around PostHog event tracking.
 *
 * Features:
 * - Single `track` function for capturing named events with optional properties
 * - Null-safe: if PostHog is not initialized (missing API key), calls are no-ops
 * - Memoized callback to avoid unnecessary re-renders
 *
 * The underlying lib/posthog module guards against empty API keys:
 *   export const posthog = apiKey ? new PostHog(apiKey, { host }) : null;
 * So captureEvent is always safe to call even without configuration.
 *
 * Extracted from ThreadLift, made generic.
 *
 * Dependencies: lib/posthog
 */

import { useCallback } from 'react';
import { captureEvent } from '@/lib/posthog';

/**
 * useAnalytics, Event tracking hook.
 *
 * @returns {Object}
 *   - track: (event: string, properties?: Record<string, unknown>) => void
 *
 * Usage:
 *   const { track } = useAnalytics();
 *   track('button_pressed', { screen: 'home', buttonId: 'cta' });
 */
export function useAnalytics() {
  const track = useCallback((event: string, properties?: Record<string, unknown>) => {
    captureEvent(event, properties);
  }, []);

  return { track };
}
