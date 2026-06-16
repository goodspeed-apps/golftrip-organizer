/**
 * Tests for lib/store-review.ts
 */

const store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve(); }),
    removeItem: jest.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  },
}));
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
}));
jest.mock('../../lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn() }));

import { recordSession, recordPositiveAction, maybePromptReview } from '../../lib/store-review';
import * as StoreReview from 'expo-store-review';

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe('recordSession', () => {
  test('increments session count', async () => {
    await recordSession();
    await recordSession();
    const slug = require('../../gas.config').gasConfig.app.slug;
    const raw = store.get(`@${slug}:store_review`);
    const state = JSON.parse(raw!);
    expect(state.sessionCount).toBe(2);
  });
});

describe('recordPositiveAction', () => {
  test('increments positive action count', async () => {
    await recordPositiveAction();
    await recordPositiveAction();
    await recordPositiveAction();
    const slug = require('../../gas.config').gasConfig.app.slug;
    const raw = store.get(`@${slug}:store_review`);
    const state = JSON.parse(raw!);
    expect(state.positiveActionCount).toBe(3);
  });
});

describe('maybePromptReview', () => {
  test('returns false when sessions below threshold', async () => {
    await recordSession();
    const result = await maybePromptReview();
    expect(result).toBe(false);
  });

  test('returns false when positive actions below threshold', async () => {
    for (let i = 0; i < 5; i++) await recordSession();
    const result = await maybePromptReview();
    expect(result).toBe(false);
  });

  test('prompts when all conditions met', async () => {
    for (let i = 0; i < 5; i++) await recordSession();
    for (let i = 0; i < 3; i++) await recordPositiveAction();
    const result = await maybePromptReview();
    expect(result).toBe(true);
    expect(StoreReview.requestReview).toHaveBeenCalled();
  });

  test('returns false when store review unavailable', async () => {
    for (let i = 0; i < 5; i++) await recordSession();
    for (let i = 0; i < 3; i++) await recordPositiveAction();
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    const result = await maybePromptReview();
    expect(result).toBe(false);
  });

  test('respects cooldown period', async () => {
    for (let i = 0; i < 5; i++) await recordSession();
    for (let i = 0; i < 3; i++) await recordPositiveAction();
    // First prompt succeeds
    await maybePromptReview();
    // Second prompt within cooldown fails
    const result = await maybePromptReview();
    expect(result).toBe(false);
  });
});
