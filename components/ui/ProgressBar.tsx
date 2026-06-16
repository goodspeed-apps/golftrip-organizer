/**
 * GAS Template, ProgressBar
 *
 * Horizontal progress indicator with optional label.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { View, Text, type ViewStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

interface ProgressBarProps {
  /** Progress value between 0 and 1 */
  progress: number;
  /** Bar color (default: primary from gasConfig) */
  color?: string;
  /** Height of the bar (default: 6) */
  height?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label text override (e.g., "3 of 10") */
  label?: string;
  /** Style override */
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  color,
  height = 6,
  showLabel = false,
  label,
  style,
}: ProgressBarProps) {
  const { colors } = useThemeColors();
  const fill = color ?? gasConfig.design.colors.primary;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={style}>
      {(showLabel || label) && (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
          {label ?? `${Math.round(clamped * 100)}%`}
        </Text>
      )}
      <View
        style={{
          height,
          backgroundColor: colors.border,
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      >
        <View
          style={{
            height: '100%',
            width: `${clamped * 100}%`,
            backgroundColor: fill,
            borderRadius: height / 2,
          }}
        />
      </View>
    </View>
  );
}
