/**
 * GAS Template, Button
 *
 * Configurable button with variant, size, loading state, and icon support.
 * Reads border radius and button style from gasConfig.design.layout.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { ActivityIndicator, Text, TouchableOpacity, type ViewStyle, type TextStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  /** Button label text */
  label: string;
  /** Press handler */
  onPress: () => void;
  /** Visual variant (default: primary) */
  variant?: ButtonVariant;
  /** Size preset (default: md) */
  size?: ButtonSize;
  /** Show loading spinner and disable press */
  loading?: boolean;
  /** Disable the button */
  disabled?: boolean;
  /** Lucide icon component to show before label */
  icon?: React.ElementType;
  /** Icon size override (defaults to font size) */
  iconSize?: number;
  /** Take full width of container */
  fullWidth?: boolean;
  /** Additional style overrides */
  style?: ViewStyle;
/** Accessibility label override */
  accessibilityLabel?: string;
  /** Test ID for automated testing */
  testID?: string;
}

const SIZE_MAP: Record<ButtonSize, { height: number; px: number; fontSize: number }> = {
  sm: { height: 36, px: 14, fontSize: 13 },
  md: { height: 48, px: 20, fontSize: 15 },
  lg: { height: 56, px: 28, fontSize: 17 },
};

function getRadius(): number {
  const style = gasConfig.design.layout.buttonStyle;
  if (style === 'pill') return 999;
  if (style === 'square') return 6;
  return 14; // rounded (default)
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconSize,
  fullWidth = false,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const { colors } = useThemeColors();
  const s = SIZE_MAP[size];
  const radius = getRadius();
  const isDisabled = disabled || loading;

  const variants: Record<ButtonVariant, { bg: string; border?: string; text: string }> = {
    primary: { bg: colors.primary, text: '#FFFFFF' },
    secondary: { bg: colors.surface, border: colors.border, text: colors.text },
    outline: { bg: 'transparent', border: colors.border, text: colors.text },
    ghost: { bg: 'transparent', text: colors.text },
    destructive: { bg: colors.error ?? '#EF4444', text: '#FFFFFF' },
  };

  const v = variants[variant];

  const containerStyle: ViewStyle = {
    height: s.height,
    paddingHorizontal: s.px,
    borderRadius: radius,
    backgroundColor: v.bg,
    borderWidth: v.border ? 1 : 0,
    borderColor: v.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: isDisabled ? 0.5 : 1,
    alignSelf: fullWidth ? 'stretch' : 'auto',
    ...style,
  };

  const textStyle: TextStyle = {
    color: v.text,
    fontSize: s.fontSize,
    fontWeight: '600',
  };

  const iconSz = iconSize ?? s.fontSize;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={containerStyle}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {Icon && <Icon size={iconSz} color={v.text} />}
          <Text style={textStyle}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
