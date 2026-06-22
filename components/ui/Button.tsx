import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
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
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
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
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useThemeColors();

  const sizeStyles: Record<string, { paddingVertical: number; paddingHorizontal: number; fontSize: number; borderRadius: number }> = {
    sm: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13, borderRadius: 8 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, borderRadius: 12 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17, borderRadius: 14 },
  };

  const currentSize = sizeStyles[size];

  const getBackgroundColor = () => {
    if (disabled || loading) return colors.border;
    switch (variant) {
      case 'primary': return colors.primary;
      case 'secondary': return colors.secondary ?? colors.surface;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      case 'destructive': return colors.error;
      default: return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled || loading) return colors.textSecondary;
    switch (variant) {
      case 'primary': return colors.textOnPrimary;
      case 'secondary': return colors.text;
      case 'outline': return colors.primary;
      case 'ghost': return colors.primary;
      case 'destructive': return '#fff';
      default: return colors.textOnPrimary;
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') return colors.primary;
    if (variant === 'secondary') return colors.border;
    return 'transparent';
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor: getBackgroundColor(),
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal,
          borderRadius: currentSize.borderRadius,
          borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0,
          borderColor: getBorderColor(),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: getTextColor(),
              fontSize: currentSize.fontSize,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '600',
  },
});
