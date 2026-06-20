/**
 * GAS Template, CreditBadge Component
 *
 * Small inline display for credit balance.
 * Shows currency icon + balance number.
 * Tappable to navigate to credit purchase.
 *
 * Config-driven: reads currency name and icon from gasConfig.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

const CREDITS_CONFIG = gasConfig.features.inAppPurchases.credits;

interface CreditBadgeProps {
  balance: number;
  size?: 'sm' | 'md';
  onPress?: () => void;
}

export function CreditBadge({ balance, size = 'sm', onPress }: CreditBadgeProps) {
  const { colors } = useThemeColors();

  if (!CREDITS_CONFIG?.enabled) return null;

  const isSmall = size === 'sm';

  const content = (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.primary + '1A',
        borderColor: colors.primary + '33',
        paddingHorizontal: isSmall ? 8 : 12,
        paddingVertical: isSmall ? 4 : 6,
      },
    ]}>
      <Text style={[
        styles.value,
        {
          color: colors.primary,
          fontSize: isSmall ? 13 : 16,
        },
      ]}>
        {balance.toLocaleString()}
      </Text>
      <Text style={[
        styles.label,
        {
          color: colors.primary,
          fontSize: isSmall ? 11 : 13,
        },
      ]}>
        {CREDITS_CONFIG.currencyName}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityLabel={`${balance} ${CREDITS_CONFIG.currencyNamePlural}. Tap to buy more.`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  value: {
    fontWeight: '800',
  },
  label: {
    fontWeight: '600',
  },
});
