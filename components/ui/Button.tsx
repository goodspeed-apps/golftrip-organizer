import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
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
  ...rest
}: ButtonProps) {
  const { colors } = useThemeColors();

  const sizeStyles: Record<string, { paddingVertical: number; paddingHorizontal: number; fontSize: number; borderRadius: number }> = {
    sm: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13, borderRadius: 8 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, borderRadius: 12 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17, borderRadius: 14 },
  };

  const variantContainerStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.error },
  };

  const variantTextStyles: Record<string, TextStyle> = {
    primary: { color: colors.textOnPrimary },
    secondary: { color: colors.text },
    outline: { color: colors.primary },
    ghost: { color: colors.primary },
    danger: { color: '#fff' },
  };

  const { paddingVertical, paddingHorizontal, fontSize, borderRadius } = sizeStyles[size];

  const containerStyle: ViewStyle = {
    paddingVertical,
    paddingHorizontal,
    borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled || loading ? 0.5 : 1,
    ...variantContainerStyles[variant],
    ...style,
  };

  const labelStyle: TextStyle = {
    fontSize,
    fontWeight: '600',
    ...variantTextStyles[variant],
    ...textStyle,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={containerStyle}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary}
        />
      ) : (
        <Text style={labelStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
