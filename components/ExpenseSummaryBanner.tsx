import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

interface Props { totalCents: number; myShareCents: number; }

export function ExpenseSummaryBanner({ totalCents, myShareCents }: Props) {
  const colors = useThemeColors();
  const fmt = (cents: number) => `$${((cents ?? 0) / 100).toFixed(2)}`;
  return (
    <Animated.View entering={FadeInDown.duration(300)}
      style={{ margin: 16, borderRadius: 16, padding: 20, backgroundColor: colors.primary,
        shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: colors.textOnPrimary, fontFamily: 'Inter_400Regular', fontSize: 13, opacity: 0.85 }}>Total Trip Cost</Text>
          <Text style={{ color: colors.textOnPrimary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, marginTop: 2 }}>{fmt(totalCents)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.textOnPrimary, fontFamily: 'Inter_400Regular', fontSize: 13, opacity: 0.85 }}>My Share</Text>
          <Text style={{ color: colors.textOnPrimary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, marginTop: 2 }}>{fmt(myShareCents)}</Text>
        </View>
      </View>
    </Animated.View>
  );
}
