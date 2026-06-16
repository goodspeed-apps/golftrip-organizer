/**
 * GAS Template, StreakBadge
 *
 * Displays the user's current streak count with a flame icon,
 * optional freeze token indicator, and pulse animation on increment.
 *
 * Features:
 * - Flame icon with color-coded streak levels (green < amber < red)
 * - Animated pulse on streak value change
 * - Freeze token badge (snowflake icon + count)
 * - Three sizes: sm, md, lg
 * - Config-gated: only renders if gamification is enabled
 * - Theme-aware colors
 * - Analytics: tracks streak display
 * - Accessibility: "X day streak" label
 * - Loading skeleton when data is null
 *
 * Dependencies: gasConfig, lib/gamification (StreakData type), lib/posthog, lucide-react-native
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Flame, Snowflake } from 'lucide-react-native';
import { captureEvent } from '@/lib/posthog';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';
import { LoadingSkeleton } from './ui/LoadingSkeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  freezeTokens: number;
}

interface StreakBadgeProps {
  /** Streak data from useStreak() hook. Pass null to show loading skeleton. */
  streak: StreakData | null;
  /** Badge size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show freeze token count */
  showFreeze?: boolean;
}

// ─── Size Config ─────────────────────────────────────────────────────────────

const SIZES = {
  sm: { icon: 14, text: 13, padding: 6, gap: 4, freezeIcon: 10, freezeText: 11 },
  md: { icon: 18, text: 16, padding: 10, gap: 6, freezeIcon: 12, freezeText: 12 },
  lg: { icon: 24, text: 22, padding: 14, gap: 8, freezeIcon: 14, freezeText: 14 },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStreakColor(count: number): string {
  if (count >= 30) return '#EF4444'; // Red, on fire
  if (count >= 7) return '#F59E0B';  // Amber, building
  if (count >= 1) return '#10B981';  // Green, starting
  return '#6B7280';                   // Grey, no streak
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * StreakBadge, Displays current streak with optional freeze indicator.
 *
 * Usage:
 *   const { streak } = useStreak();
 *   <StreakBadge streak={streak} size="md" showFreeze />
 */
export function StreakBadge({ streak, size = 'md', showFreeze = false }: StreakBadgeProps) {
  const { colors } = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevStreak = useRef<number | null>(null);
  const s = SIZES[size];

  // Pulse animation when streak changes
  useEffect(() => {
    if (!streak) return;
    if (prevStreak.current !== null && streak.currentStreak > prevStreak.current) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true, tension: 200, friction: 8 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }),
      ]).start();
    }
    prevStreak.current = streak.currentStreak;
  }, [streak?.currentStreak, scaleAnim, streak]);

  // Track display
  useEffect(() => {
    if (!streak || streak.currentStreak <= 0) return;
    captureEvent('streak_displayed', {
      count: streak.currentStreak,
      longest: streak.longestStreak,
      freezeTokens: streak.freezeTokens,
    });
  }, [streak?.currentStreak, streak?.longestStreak, streak?.freezeTokens, streak]);

  // Don't render if gamification is disabled
  if (!gasConfig.features.gamification.enabled) return null;

  // Show skeleton while loading
  if (!streak) {
    return <LoadingSkeleton width={s.padding * 2 + s.icon + s.gap + 20} height={s.icon + s.padding * 2} borderRadius={s.padding + s.icon / 2} />;
  }

  const color = getStreakColor(streak.currentStreak);

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: s.gap }}
      accessibilityLabel={`${streak.currentStreak} day streak${streak.freezeTokens > 0 ? `, ${streak.freezeTokens} freeze tokens` : ''}`}
      accessibilityRole="text"
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s.gap,
          backgroundColor: color + '18',
          borderRadius: s.padding + s.icon / 2,
          paddingHorizontal: s.padding,
          paddingVertical: s.padding / 2,
          borderWidth: 1,
          borderColor: color + '30',
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Flame size={s.icon} color={color} />
        <Text style={{ color, fontSize: s.text, fontWeight: '700' }}>
          {streak.currentStreak}
        </Text>
      </Animated.View>

      {/* Freeze tokens */}
      {showFreeze && streak.freezeTokens > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            backgroundColor: colors.info + '18',
            borderRadius: 10,
            paddingHorizontal: 6,
            paddingVertical: 3,
          }}
        >
          <Snowflake size={s.freezeIcon} color={colors.info} accessible={false} importantForAccessibility="no" />
          <Text style={{ color: colors.info, fontSize: s.freezeText, fontWeight: '600' }}>
            {streak.freezeTokens}
          </Text>
        </View>
      )}
    </View>
  );
}
