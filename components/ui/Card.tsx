/**
 * GAS Template, Card
 *
 * Themed container card that respects gasConfig.design.layout.cardStyle.
 * Variants: flat, elevated, outlined, filled.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { View, Pressable, type ViewStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

interface CardProps {
  children: React.ReactNode;
  /** Override cardStyle from gasConfig */
  variant?: 'flat' | 'elevated' | 'outlined' | 'filled';
  /** Press handler, makes the card tappable */
  onPress?: () => void;
  /** Additional style overrides */
  style?: ViewStyle;
  /** Padding preset (default: 16) */
  padding?: number;
}

export function Card({
  children,
  variant,
  onPress,
  style,
  padding = 16,
}: CardProps) {
  const { colors } = useThemeColors();
  const cardVariant = variant ?? gasConfig.design.layout.cardStyle;

  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding,
  };

  const variantStyles: Record<string, ViewStyle> = {
    flat: {},
    elevated: {
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    outlined: {
      borderWidth: 1,
      borderColor: colors.border,
    },
    filled: {
      backgroundColor: colors.surface,
    },
  };

  const cardStyle: ViewStyle = { ...base, ...variantStyles[cardVariant], ...style };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}
