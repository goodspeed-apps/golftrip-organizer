/**
 * Tests for lib/gamification.ts
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
jest.mock('../../lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn() }));

import { recordDailyActivity, incrementPoints, checkAndUnlockAchievements, updateWeeklyScore, DEFAULT_ACHIEVEMENTS } from '../../lib/gamification';
import type { StreakData } from '../../lib/gamification';
import { captureEvent } from '../../lib/posthog';

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe('recordDailyActivity', () => {
  test('first ever activity returns streak of 1', async () => {
    const result = await recordDailyActivity();
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.lastActivityDate).not.toBeNull();
  });

  test('same day returns same streak (no-op)', async () => {
    const first = await recordDailyActivity();
    const second = await recordDailyActivity();
    expect(second.current).toBe(first.current);
  });

  test('consecutive day increments streak', async () => {
    // Seed yesterday's streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const slug = require('../../gas.config').gasConfig.app.slug;
    store.set(`@${slug}:streak`, JSON.stringify({
      current: 5, longest: 5, lastActivityDate: yStr, freezeTokens: 0,
    }));

    const result = await recordDailyActivity();
    expect(result.current).toBe(6);
    expect(result.longest).toBe(6);
  });

  test('gap without freeze token resets streak to 1', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 3);
    const dateStr = twoDaysAgo.toISOString().split('T')[0];
    const slug = require('../../gas.config').gasConfig.app.slug;
    store.set(`@${slug}:streak`, JSON.stringify({
      current: 10, longest: 10, lastActivityDate: dateStr, freezeTokens: 0,
    }));

    const result = await recordDailyActivity();
    expect(result.current).toBe(1);
    expect(captureEvent).toHaveBeenCalledWith('streak_broken', expect.objectContaining({ previousCount: 10 }));
  });

  test('gap with freeze token continues streak', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const dateStr = twoDaysAgo.toISOString().split('T')[0];
    const slug = require('../../gas.config').gasConfig.app.slug;
    store.set(`@${slug}:streak`, JSON.stringify({
      current: 5, longest: 5, lastActivityDate: dateStr, freezeTokens: 1,
    }));

    const result = await recordDailyActivity();
    expect(result.current).toBe(6);
    expect(result.freezeTokens).toBe(0); // token consumed
  });

  test('awards freeze token at day 7', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const slug = require('../../gas.config').gasConfig.app.slug;
    store.set(`@${slug}:streak`, JSON.stringify({
      current: 6, longest: 6, lastActivityDate: yStr, freezeTokens: 0,
    }));

    const result = await recordDailyActivity();
    expect(result.current).toBe(7);
    expect(result.freezeTokens).toBe(1); // bonus at 7
  });
});

describe('incrementPoints', () => {
  test('adds points and returns new total', async () => {
    const total = await incrementPoints(50);
    expect(total).toBe(50);
    const total2 = await incrementPoints(30);
    expect(total2).toBe(80);
  });
});

describe('checkAndUnlockAchievements', () => {
  test('unlocks first_activity achievement', async () => {
    const streak: StreakData = { current: 1, longest: 1, lastActivityDate: '2024-01-01', freezeTokens: 0 };
    const result = await checkAndUnlockAchievements(streak, 0);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(a => a.id === 'first_day')).toBe(true);
  });

  test('unlocks points achievement when threshold met', async () => {
    const streak: StreakData = { current: 1, longest: 1, lastActivityDate: '2024-01-01', freezeTokens: 0 };
    const result = await checkAndUnlockAchievements(streak, 100);
    expect(result.some(a => a.id === 'points_100')).toBe(true);
  });

  test('skips already unlocked achievements', async () => {
    const streak: StreakData = { current: 1, longest: 1, lastActivityDate: '2024-01-01', freezeTokens: 0 };
    // First unlock
    await checkAndUnlockAchievements(streak, 0);
    // Second call — should not re-unlock
    const result2 = await checkAndUnlockAchievements(streak, 0);
    expect(result2.some(a => a.id === 'first_day')).toBe(false);
  });

  test('uses custom achievement schema', async () => {
    const streak: StreakData = { current: 5, longest: 5, lastActivityDate: '2024-01-01', freezeTokens: 0 };
    const custom = [{ id: 'custom_streak', title: 'Custom', description: 'Test', unlockCondition: { type: 'streak' as const, threshold: 5 } }];
    const result = await checkAndUnlockAchievements(streak, 0, custom);
    expect(result.some(a => a.id === 'custom_streak')).toBe(true);
  });
});

describe('updateWeeklyScore', () => {
  test('accumulates scores within same week', async () => {
    const result1 = await updateWeeklyScore({ tasks: 3 });
    expect(result1.tasks).toBe(3);
    const result2 = await updateWeeklyScore({ tasks: 2 });
    expect(result2.tasks).toBe(5);
  });
});

describe('load error handling', () => {
  test('returns defaults for corrupted data', async () => {
    const slug = require('../../gas.config').gasConfig.app.slug;
    store.set(`@${slug}:streak`, '{not valid json!!!');
    const result = await recordDailyActivity();
    expect(result.current).toBe(1); // fresh start
  });
});
