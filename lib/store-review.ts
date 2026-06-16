/**
 * GAS Template, Smart App Store Review Prompting
 *
 * Manages when to ask users for an App Store / Play Store review,
 * following Apple's guidelines and best practices.
 *
 * Features:
 * - Session-count and positive-action-count based triggers
 * - Cooldown period (120 days between prompts)
 * - Checks StoreReview.isAvailableAsync() before prompting
 * - Never prompts after negative experiences
 * - Persists prompt history to AsyncStorage
 * - Analytics tracking for prompt events
 *
 * Config: active when the app has analytics enabled.
 *
 * Dependencies: expo-store-review, @react-native-async-storage/async-storage, lib/posthog
 */

import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureEvent } from './posthog';
import { addBreadcrumb } from './sentry';
import { gasConfig } from '../gas.config';

const STORAGE_KEY = `@${gasConfig.app.slug}:store_review`;
const COOLDOWN_DAYS = 120;
const MIN_SESSIONS = 5;
const MIN_POSITIVE_ACTIONS = 3;

interface ReviewState {
  sessionCount: number;
  positiveActionCount: number;
  lastPromptedAt: string | null;
  hasBeenPrompted: boolean;
}

async function getState(): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore storage errors
  }
  return {
    sessionCount: 0,
    positiveActionCount: 0,
    lastPromptedAt: null,
    hasBeenPrompted: false,
  };
}

async function setState(state: ReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Increment the session count. Call once per app launch (in _layout.tsx).
 */
export async function recordSession(): Promise<void> {
  const state = await getState();
  state.sessionCount += 1;
  await setState(state);
}

/**
 * Record a positive user action (e.g., completing a task, achieving a goal).
 * Call after meaningful positive moments in the app.
 */
export async function recordPositiveAction(): Promise<void> {
  const state = await getState();
  state.positiveActionCount += 1;
  await setState(state);
}

/**
 * Maybe show the review prompt if all conditions are met:
 * - Session count >= MIN_SESSIONS
 * - Positive action count >= MIN_POSITIVE_ACTIONS
 * - Not prompted within COOLDOWN_DAYS
 * - StoreReview is available on this device
 *
 * @returns true if the prompt was shown, false otherwise
 */
export async function maybePromptReview(): Promise<boolean> {
  const state = await getState();

  // Check thresholds
  if (state.sessionCount < MIN_SESSIONS) return false;
  if (state.positiveActionCount < MIN_POSITIVE_ACTIONS) return false;

  // Check cooldown
  if (state.lastPromptedAt) {
    const lastPrompted = new Date(state.lastPromptedAt).getTime();
    const daysSince = (Date.now() - lastPrompted) / (1000 * 60 * 60 * 24);
    if (daysSince < COOLDOWN_DAYS) return false;
  }

  // Check availability
  const isAvailable = await StoreReview.isAvailableAsync();
  captureEvent('store_review_available', { available: isAvailable });

  if (!isAvailable) return false;

  // Show the prompt
  try {
    await StoreReview.requestReview();
    captureEvent('store_review_prompted', {
      sessions: state.sessionCount,
      positiveActions: state.positiveActionCount,
    });
    addBreadcrumb('engagement', 'Store review prompted');

    // Update state
    state.lastPromptedAt = new Date().toISOString();
    state.hasBeenPrompted = true;
    await setState(state);

    return true;
  } catch {
    return false;
  }
}
