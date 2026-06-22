/**
 * GAS Template, Button Component
 *
 * A flexible, accessible button with variants and loading state.
 * Supports 'primary', 'secondary', 'ghost', and 'danger' variants.
 * Supports 'sm', 'md', and 'lg' sizes.
 *
 * All colors come from useThemeColors(), never hardcoded.
 */

import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

export interface ButtonProps {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useThemeColors();

  const sizeStyles = {
    sm: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    md: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, borderRadius: 14 },
  };

  const textSizes = {
    sm: { fontSize: 13 },
    md: { fontSize: 15 },
    lg: { fontSize: 17 },
  };

  const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: colors.textOnPrimary ?? '#fff' },
    secondary: { bg: colors.surface, text: colors.text, border: colors.border },
    ghost: { bg: 'transparent', text: colors.primary },
    danger: { bg: colors.error, text: '#fff' },
  };

  const v = variantStyles[variant] ?? variantStyles.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        sizeStyles[size],
        {
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <Text
          style={[
            textSizes[size],
            { color: v.text, fontWeight: '600' },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
