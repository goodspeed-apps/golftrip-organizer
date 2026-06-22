import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle, type TextStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

export interface ButtonProps {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useThemeColors();

  const sizeStyles: Record<string, { paddingVertical: number; paddingHorizontal: number; fontSize: number; borderRadius: number }> = {
    sm: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13, borderRadius: 8 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, borderRadius: 12 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17, borderRadius: 14 },
  };

  const s = sizeStyles[size];

  const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: colors.textOnPrimary ?? '#FFFFFF' },
    secondary: { bg: colors.surface, text: colors.text },
    outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', text: colors.textSecondary },
    destructive: { bg: colors.error, text: '#FFFFFF' },
  };

  const v = variantStyles[variant];

  const containerStyle: ViewStyle = {
    backgroundColor: v.bg,
    paddingVertical: s.paddingVertical,
    paddingHorizontal: s.paddingHorizontal,
    borderRadius: s.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    opacity: disabled || loading ? 0.6 : 1,
    ...(v.border ? { borderWidth: 1, borderColor: v.border } : {}),
    ...style,
  };

  const labelStyle: TextStyle = {
    fontSize: s.fontSize,
    fontWeight: '600',
    color: v.text,
    ...textStyle,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={containerStyle}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" style={{ marginRight: 6 }} />
      ) : null}
      <Text style={labelStyle}>{title}</Text>
    </TouchableOpacity>
  );
}
