/**
 * GAS Template, Badge
 *
 * Small status indicator with label and color variants.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { View, Text } from 'react-native';
import { gasConfig } from '../../gas.config';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  /** Badge label */
  label: string;
  /** Color variant (default: default) */
  variant?: BadgeVariant;
  /** Custom background color (overrides variant) */
  color?: string;
  /** Show as small dot without text */
  dot?: boolean;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: '#6B728018', text: '#6B7280' },
  success: { bg: gasConfig.design.colors.success + '18', text: gasConfig.design.colors.success },
  warning: { bg: gasConfig.design.colors.warning + '18', text: gasConfig.design.colors.warning },
  error: { bg: gasConfig.design.colors.error + '18', text: gasConfig.design.colors.error },
  info: { bg: gasConfig.design.colors.primary + '18', text: gasConfig.design.colors.primary },
};

export function Badge({ label, variant = 'default', color, dot }: BadgeProps) {
  const v = VARIANT_COLORS[variant];
  const bg = color ? color + '18' : v.bg;
  const text = color ?? v.text;

  if (dot) {
    return (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: text,
        }}
        accessibilityLabel={label}
      />
    );
  }

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: text, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
