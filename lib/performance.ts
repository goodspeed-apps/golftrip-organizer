/**
 * GAS Template, Performance Monitoring
 *
 * Lightweight performance tracking utilities that emit metrics via PostHog.
 * All measurements are fire-and-forget: they never block UI or throw errors.
 *
 * Features:
 * - Screen load time tracking (mount → data ready)
 * - API call latency measurement
 * - App cold start measurement
 * - User interaction timing
 * - Threshold-based warnings via Sentry breadcrumbs
 * - PerformanceTracker class for custom measurements
 *
 * Config: active when gasConfig.features.analytics.enabled is true.
 *
 * Dependencies: lib/posthog, lib/sentry
 */

import { captureEvent } from './posthog';
import { addBreadcrumb } from './sentry';
import { gasConfig } from '../gas.config';

const enabled = gasConfig.features.analytics.enabled;

// Thresholds (in ms), exceeding these triggers a Sentry breadcrumb warning
const THRESHOLDS = {
  screenLoad: 3000,
  apiLatency: 2000,
  appStartup: 4000,
  interaction: 1000,
} as const;

/**
 * Track how long a screen takes from mount to data-ready.
 *
 * Usage:
 *   const startTime = Date.now();
 *   useEffect(() => { if (data) trackScreenLoad('Dashboard', startTime); }, [data]);
 */
export function trackScreenLoad(screenName: string, startTimeMs: number): void {
  if (!enabled) return;
  const duration = Date.now() - startTimeMs;
  captureEvent('perf_screen_load', {
    screen: screenName,
    duration_ms: duration,
  });
  if (duration > THRESHOLDS.screenLoad) {
    addBreadcrumb('performance', `Slow screen load: ${screenName} (${duration}ms)`, {
      screen: screenName,
      duration_ms: String(duration),
      threshold_ms: String(THRESHOLDS.screenLoad),
    });
  }
}

/**
 * Track API call latency.
 *
* Two usage patterns are both supported:
 *   // 1. Timer: call with just the endpoint, get a stop function back.
 *   const end = trackApiLatency('my-function');
 *   const data = await callEdge('my-function');
 *   end?.();
 *
 *   // 2. Direct: report a duration you already measured.
 *   const start = Date.now();
 *   const data = await callEdge('my-function');
 *   trackApiLatency('my-function', Date.now() - start);
 */
export function trackApiLatency(endpoint: string): () => void;
export function trackApiLatency(endpoint: string, durationMs: number, cached?: boolean): void;
export function trackApiLatency(
  endpoint: string,
  durationMs?: number,
  cached = false
): (() => void) | void {
  // Timer mode: no duration supplied, return a stop function that reports the
  // elapsed time when called. Lets generated code use the common
  // `const end = trackApiLatency('x'); ...; end?.()` pattern.
  if (durationMs === undefined) {
    const start = Date.now();
    return () => trackApiLatency(endpoint, Date.now() - start, false);
  }
  if (!enabled) return;
  captureEvent('perf_api_latency', {
    endpoint,
    duration_ms: durationMs,
    cached,
  });
  if (!cached && durationMs > THRESHOLDS.apiLatency) {
    addBreadcrumb('performance', `Slow API call: ${endpoint} (${durationMs}ms)`, {
      endpoint,
      duration_ms: String(durationMs),
      threshold_ms: String(THRESHOLDS.apiLatency),
    });
  }
}

/**
 * Track app cold start time.
 * Call once from _layout.tsx after the splash screen is hidden.
 *
 * Usage:
 *   // At top of _layout.tsx (module scope):
 *   const APP_START_TIME = Date.now();
 *   // In first useEffect:
 *   trackAppStartup(Date.now() - APP_START_TIME);
 */
export function trackAppStartup(coldStartMs: number): void {
  if (!enabled) return;
  captureEvent('perf_app_startup', {
    cold_start_ms: coldStartMs,
  });
  if (coldStartMs > THRESHOLDS.appStartup) {
    addBreadcrumb('performance', `Slow cold start: ${coldStartMs}ms`, {
      cold_start_ms: String(coldStartMs),
      threshold_ms: String(THRESHOLDS.appStartup),
    });
  }
}

/**
 * Track a user interaction's response time.
 *
 * Usage:
 *   const start = Date.now();
 *   await doExpensiveAction();
 *   trackInteraction('apply_filter', Date.now() - start);
 */
export function trackInteraction(action: string, durationMs: number): void {
  if (!enabled) return;
  captureEvent('perf_interaction', {
    action,
    duration_ms: durationMs,
  });
  if (durationMs > THRESHOLDS.interaction) {
    addBreadcrumb('performance', `Slow interaction: ${action} (${durationMs}ms)`, {
      action,
      duration_ms: String(durationMs),
    });
  }
}

/**
 * PerformanceTracker, Reusable timer for custom measurements.
 *
 * Usage:
 *   const perf = new PerformanceTracker();
 *   perf.start('data_transform');
 *   // ... do work ...
 *   perf.end('data_transform'); // automatically emits perf_measurement event
 */
export class PerformanceTracker {
  private timers = new Map<string, number>();

  start(label: string): void {
    this.timers.set(label, Date.now());
  }

  end(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) return 0;
    this.timers.delete(label);
    const duration = Date.now() - startTime;
    if (enabled) {
      captureEvent('perf_measurement', { label, duration_ms: duration });
    }
    return duration;
  }
}
