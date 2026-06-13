/**
 * GAS Template, Gamification Engine
 *
 * Streak tracking, points accumulation, achievement unlocking, and weekly
 * activity scoring, all persisted in AsyncStorage.
 *
 * This is a GENERIC engine. App-specific achievements and weekly score
 * categories are defined by the DevAgent when generating the app.
 * The template provides the infrastructure; the app fills in the schema.
 *
 * Config: gasConfig.features.gamification.enabled and .elements control
 * which features are active (streaks, points, achievements, leaderboard).
 *
 * Dependencies: @react-native-async-storage/async-storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import { captureEvent } from './posthog';
import { addBreadcrumb } from './sentry';
import { gasConfig } from '../gas.config';

// --- Storage Keys ---
// Uses app slug as prefix to avoid collisions if multiple GAS apps share a device.
const PREFIX = `@${gasConfig.app.slug}:`;
const K = {
  streak: `${PREFIX}streak`,
  points: `${PREFIX}points`,
  achievements: `${PREFIX}achievements`,
  weeklyScore: `${PREFIX}weekly_score`,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StreakData {
  current: number;
  longest: number;
  lastActivityDate: string | null;
  freezeTokens: number;
}

export interface UnlockCondition {
  type: 'streak' | 'points' | 'first_activity';
  threshold: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: string | null;
  unlockCondition?: UnlockCondition;
}

export interface WeeklyScore {
  [category: string]: number | string;
  weekStart: string;
}

// ─── Default Achievement Schema ──────────────────────────────────────────────
// Generic achievements that work for any app. DevAgent can extend this
// by adding app-specific achievements to the array.

const DEFAULT_ACHIEVEMENTS: Omit<Achievement, 'unlockedAt'>[] = [
  { id: 'first_day', title: 'First Day', description: 'Used the app for the first time', unlockCondition: { type: 'first_activity', threshold: 1 } },
  { id: 'streak_7', title: 'Week Warrior', description: '7-day activity streak', unlockCondition: { type: 'streak', threshold: 7 } },
  { id: 'streak_30', title: 'Month Master', description: '30-day activity streak', unlockCondition: { type: 'streak', threshold: 30 } },
  { id: 'streak_100', title: 'Century Club', description: '100-day activity streak', unlockCondition: { type: 'streak', threshold: 100 } },
  { id: 'points_100', title: 'Point Collector', description: 'Earned 100 points', unlockCondition: { type: 'points', threshold: 100 } },
  { id: 'points_1000', title: 'Power User', description: 'Earned 1,000 points', unlockCondition: { type: 'points', threshold: 1000 } },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function weekStartStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0] ?? '';
}

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    addBreadcrumb('gamification', 'Failed to load data, returning defaults', { key });
    return fallback;
  }
}

async function save<T>(key: string, val: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    addBreadcrumb('gamification', 'Failed to save data', { key });
    captureEvent('gamification_save_error', { key });
  }
}

// ─── Streaks ─────────────────────────────────────────────────────────────────

/**
 * Record daily activity. Maintains streak continuity:
 * - Same day: no-op (returns current)
 * - Consecutive day: streak +1
 * - Gap with freeze token: streak continues, token consumed
 * - Gap without freeze: streak resets to 1
 *
 * Earns a freeze token every 7 consecutive days.
 */
export async function recordDailyActivity(): Promise<StreakData> {
  const streak = await load<StreakData>(K.streak, {
    current: 0,
    longest: 0,
    lastActivityDate: null,
    freezeTokens: 0,
  });

  const today = todayStr();
  if (streak.lastActivityDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];

  let newCurrent: number;
  if (streak.lastActivityDate === yStr) {
    // Consecutive day
    newCurrent = streak.current + 1;
  } else if (streak.lastActivityDate !== null) {
    // Missed a day, check freeze token
    if (streak.freezeTokens > 0) {
      newCurrent = streak.current + 1;
      streak.freezeTokens -= 1;
    } else {
      newCurrent = 1;
    }
  } else {
    // First ever activity
    newCurrent = 1;
  }

  // Award a freeze token every 7 consecutive days
  const freezeBonus = newCurrent % 7 === 0 ? 1 : 0;

  // Track streak broken
  if (newCurrent === 1 && streak.current > 1 && streak.freezeTokens === 0) {
    captureEvent('streak_broken', { previousCount: streak.current });
    addBreadcrumb('gamification', 'Streak broken', { previous: String(streak.current) });
  }

  // Track freeze used
  if (streak.lastActivityDate !== yStr && streak.lastActivityDate !== null && streak.freezeTokens > 0 && newCurrent > 1) {
    captureEvent('freeze_used', { streak: newCurrent });
  }

  const updated: StreakData = {
    current: newCurrent,
    longest: Math.max(streak.longest, newCurrent),
    lastActivityDate: today,
    freezeTokens: streak.freezeTokens + freezeBonus,
  };
  await save(K.streak, updated);

  captureEvent('streak_recorded', { count: newCurrent, isFrozen: streak.freezeTokens > 0 });
  return updated;
}

// ─── Points ──────────────────────────────────────────────────────────────────

/**
 * Add points to the user's total. Returns the new total.
 */
export async function incrementPoints(amount: number): Promise<number> {
  const pts = await load<number>(K.points, 0);
  const next = pts + amount;
  await save(K.points, next);
  captureEvent('points_earned', { amount, total: next });
  return next;
}

// ─── Achievements ────────────────────────────────────────────────────────────

/**
 * Check and unlock achievements based on current streak and point totals.
 *
 * @param achievements - The achievement schema to check against.
 *   Defaults to DEFAULT_ACHIEVEMENTS. Pass a custom array for app-specific
 *   achievements.
 * @returns Newly unlocked achievements (empty array if none).
 */
export async function checkAndUnlockAchievements(
  streak: StreakData,
  points: number,
  achievements: Omit<Achievement, 'unlockedAt'>[] = DEFAULT_ACHIEVEMENTS
): Promise<Achievement[]> {
  const stored = await load<Record<string, string>>(K.achievements, {});
  const newlyUnlocked: Achievement[] = [];

  for (const schema of achievements) {
    if (stored[schema.id]) continue;
    let unlock = false;

    // Data-driven achievement unlock based on unlockCondition
    const cond = schema.unlockCondition;
    if (cond) {
      switch (cond.type) {
        case 'first_activity':
          unlock = streak.current >= cond.threshold;
          break;
        case 'streak':
          unlock = streak.current >= cond.threshold;
          break;
        case 'points':
          unlock = points >= cond.threshold;
          break;
      }
    }

    if (unlock) {
      stored[schema.id] = new Date().toISOString();
      newlyUnlocked.push({ ...schema, unlockedAt: stored[schema.id] ?? null });
    }
  }

  if (newlyUnlocked.length > 0) {
    await save(K.achievements, stored);
    for (const a of newlyUnlocked) {
      captureEvent('achievement_unlocked', { achievement: a.id, title: a.title });
      addBreadcrumb('gamification', `Achievement unlocked: ${a.id}`);
    }
  }
  return newlyUnlocked;
}

// ─── Weekly Score ────────────────────────────────────────────────────────────

/**
 * Update the weekly activity score. Resets automatically on new week.
 *
 * @param delta - Partial score increments. Keys are app-specific categories
 *   (e.g., { tasksCompleted: 1, articlesRead: 2 }).
 */
export async function updateWeeklyScore(
  delta: Record<string, number>
): Promise<WeeklyScore> {
  const ws = weekStartStr();
  const current = await load<WeeklyScore>(K.weeklyScore, { weekStart: ws });

  // Reset if new week
  if (current.weekStart !== ws) {
    const fresh: WeeklyScore = { weekStart: ws, ...delta };
    await save(K.weeklyScore, fresh);
    return fresh;
  }

  // Accumulate
  const updated: WeeklyScore = { ...current };
  for (const [key, value] of Object.entries(delta)) {
    const existing = typeof current[key] === 'number' ? (current[key] as number) : 0;
    updated[key] = existing + value;
  }
  await save(K.weeklyScore, updated);
  return updated;
}

// ─── React Hooks ─────────────────────────────────────────────────────────────

/**
 * Hook: access and record daily streak.
 */
export function useStreak() {
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    load<StreakData>(K.streak, {
      current: 0,
      longest: 0,
      lastActivityDate: null,
      freezeTokens: 0,
    }).then(setStreak);
  }, []);

  const record = useCallback(async () => {
    const updated = await recordDailyActivity();
    setStreak(updated);
    return updated;
  }, []);

  return { streak, recordActivity: record };
}

/**
 * Hook: access and add points.
 */
export function usePoints() {
  const [points, setPoints] = useState(0);

  useEffect(() => {
    load<number>(K.points, 0).then(setPoints);
  }, []);

  const add = useCallback(async (amount: number) => {
    const next = await incrementPoints(amount);
    setPoints(next);
    return next;
  }, []);

  return { points, addPoints: add };
}

/**
 * Hook: access all achievements and their unlock status.
 *
 * @param schema - Custom achievement definitions. Defaults to DEFAULT_ACHIEVEMENTS.
 */
export function useAchievements(
  schema: Omit<Achievement, 'unlockedAt'>[] = DEFAULT_ACHIEVEMENTS
) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await load<Record<string, string>>(K.achievements, {});
      const result = schema.map((s) => ({
        ...s,
        unlockedAt: stored[s.id] ?? null,
      }));
      setAchievements(result);
    })();
  }, [schema]);

  return { achievements };
}

/**
 * Hook: access and update weekly score.
 */
export function useWeeklyScore() {
  const [score, setScore] = useState<WeeklyScore | null>(null);

  useEffect(() => {
    load<WeeklyScore>(K.weeklyScore, { weekStart: weekStartStr() }).then(
      setScore
    );
  }, []);

  const update = useCallback(async (delta: Record<string, number>) => {
    const updated = await updateWeeklyScore(delta);
    setScore(updated);
    return updated;
  }, []);

  return { score, updateScore: update };
}

// Export defaults for DevAgent to extend
export { DEFAULT_ACHIEVEMENTS };
