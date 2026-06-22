/**
 * GAS Template, LoadingSkeleton
 *
 * Shimmer loading placeholder with animated opacity pulse.
 *
 * Features:
 * - Configurable width, height, and borderRadius
 * - Animated opacity pulse (0.3 -> 1.0) using React Native Animated API
 * - Theme-aware surface color for the skeleton background
 * - Lightweight, no Reanimated dependency (uses core RN Animated)
 *
 * Use this as a placeholder while data is loading (e.g., in list items, cards).
 *
 * Dependencies: useThemeColors (ThemeContext)
 */

import { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface LoadingSkeletonProps {
  /** Width of the skeleton (default: '100%') */
  width?: number | `${number}%`;
  /** Height of the skeleton (default: 16) */
  height?: number;
  /** Border radius (default: 8) */
  borderRadius?: number;
/** Optional style overrides */
  style?: ViewStyle;
  /** Layout preset: 'list'/'card' adjust default height; otherwise width/height apply. */
  variant?: 'line' | 'list' | 'card' | string;
  /** Render this many stacked skeleton rows (for list/placeholder loading). */
  count?: number;
}

/**
 * LoadingSkeleton, Pulsing placeholder for loading states.
 *
 * Usage:
 *   // Single line skeleton
 *   <LoadingSkeleton width={200} height={16} />
 *
 *   // Card skeleton
 *   <View style={{ padding: 16 }}>
 *     <LoadingSkeleton width={120} height={20} borderRadius={4} />
 *     <LoadingSkeleton width="100%" height={14} style={{ marginTop: 8 }} />
 *     <LoadingSkeleton width="80%" height={14} style={{ marginTop: 4 }} />
 *   </View>
 *
 *   // Circle avatar skeleton
 *   <LoadingSkeleton width={48} height={48} borderRadius={24} />
 */
export function LoadingSkeleton({
  width = '100%',
  height,
  borderRadius = 8,
  style,
  variant = 'line',
  count = 1,
}: LoadingSkeletonProps) {
  const { colors, reducedMotion } = useThemeColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // When reduced-motion is active, skip the shimmer loop entirely and leave
    // the skeleton at a static opacity. The effect still runs so the hook
    // call order is unconditional; it just starts nothing.
    if (reducedMotion) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);

  // Default height by variant when not explicitly set.
  const rowHeight = height ?? (variant === 'card' ? 120 : variant === 'list' ? 64 : 16);
  const rows = Math.max(1, count);

  const bar = (key?: number) => (
    <Animated.View
      key={key}
      testID={reducedMotion ? 'skeleton-static' : 'skeleton-animated'}
      style={[
        {
          width,
          height: rowHeight,
          borderRadius,
          backgroundColor: colors.border,
          opacity: reducedMotion ? 0.5 : opacity,
          marginBottom: rows > 1 ? 12 : 0,
        },
        style,
      ]}
    />
  );

  if (rows > 1) {
    return <View>{Array.from({ length: rows }).map((_, i) => bar(i))}</View>;
  }
  return bar();
}
