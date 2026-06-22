/**
 * GAS Template, Button Component
 *
 * Themed button with variants, sizes, loading state, and full-width option.
 * Config-driven border radius from gasConfig.design.layout.borderRadius.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { ActivityIndicator, Pressable, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';
import { containerRadius } from '../../lib/design-tokens';

export interface ButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useThemeColors();
  const r = containerRadius();

  const sizeStyles: Record<string, { paddingVertical: number; paddingHorizontal: number; fontSize: number; minHeight: number }> = {
    sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13, minHeight: 34 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, minHeight: 44 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17, minHeight: 52 },
  };

  const s = sizeStyles[size] ?? sizeStyles.md;

  const variantContainerStyle: Record<string, ViewStyle> = {
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
    ghost: { backgroundColor: 'transparent' },
    destructive: { backgroundColor: colors.error },
  };

  const variantTextColor: Record<string, string> = {
    primary: '#FFFFFF',
    secondary: colors.text,
    outline: colors.primary,
    ghost: colors.primary,
    destructive: '#FFFFFF',
  };

  const containerStyle: ViewStyle = {
    borderRadius: r,
    paddingVertical: s.paddingVertical,
    paddingHorizontal: s.paddingHorizontal,
    minHeight: s.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    opacity: disabled || loading ? 0.5 : 1,
    alignSelf: fullWidth ? 'stretch' : 'auto',
    ...(variantContainerStyle[variant] ?? variantContainerStyle.primary),
    ...style,
  };

  const textStyle: TextStyle = {
    fontSize: s.fontSize,
    fontWeight: '600',
    color: variantTextColor[variant] ?? '#FFFFFF',
  };

  const spinnerColor = variantTextColor[variant] ?? '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [containerStyle, pressed && !disabled && !loading && { opacity: 0.8 }]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : null}
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}
