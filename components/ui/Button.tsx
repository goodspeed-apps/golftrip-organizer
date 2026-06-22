/**
 * GAS Template, Button Component
 *
 * Themed button with variants, sizes, loading state, and disabled state.
 * Variants: primary, secondary, outline, ghost, destructive.
 * Sizes: sm, md, lg.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle, type TextStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

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

  const sizeStyles: Record<string, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
    sm: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17 },
  };

  const currentSize = sizeStyles[size] ?? sizeStyles.md;

  const variantContainerStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
    ghost: { backgroundColor: 'transparent' },
    destructive: { backgroundColor: colors.error },
  };

  const variantTextColors: Record<string, string> = {
    primary: '#FFFFFF',
    secondary: colors.text,
    outline: colors.primary,
    ghost: colors.primary,
    destructive: '#FFFFFF',
  };

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: currentSize.paddingVertical,
    paddingHorizontal: currentSize.paddingHorizontal,
    opacity: disabled || loading ? 0.5 : 1,
    alignSelf: fullWidth ? 'stretch' : 'auto',
    ...(variantContainerStyles[variant] ?? variantContainerStyles.primary),
    ...style,
  };

  const textStyle: TextStyle = {
    fontSize: currentSize.fontSize,
    fontWeight: '600',
    color: variantTextColors[variant] ?? variantTextColors.primary,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={containerStyle}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantTextColors[variant] ?? '#FFFFFF'}
          style={{ marginRight: 8 }}
        />
      ) : null}
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}
