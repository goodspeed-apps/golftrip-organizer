/**
 * GAS Template, Divider
 *
 * Themed horizontal or vertical divider line.
 *
 * Dependencies: useThemeColors (ThemeContext)
 */

import { View, type ViewStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface DividerProps {
  /** Orientation (default: horizontal) */
  direction?: 'horizontal' | 'vertical';
  /** Horizontal margin for horizontal dividers, vertical margin for vertical */
  spacing?: number;
  /** Color override */
  color?: string;
  /** Style override */
  style?: ViewStyle;
}

export function Divider({
  direction = 'horizontal',
  spacing = 0,
  color,
  style,
}: DividerProps) {
  const { colors } = useThemeColors();
  const c = color ?? colors.border;

  if (direction === 'vertical') {
    return (
      <View
        style={[{ width: 1, backgroundColor: c, marginVertical: spacing }, style]}
        accessibilityRole="none"
      />
    );
  }

  return (
    <View
      style={[{ height: 1, backgroundColor: c, marginHorizontal: spacing }, style]}
      accessibilityRole="none"
    />
  );
}
