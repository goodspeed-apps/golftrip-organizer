import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

interface TeeTimeFormRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  index?: number;
}

export function TeeTimeFormRow({ icon, label, children, index = 0 }: TeeTimeFormRowProps) {
  const colors = useThemeColors();
  return (
    <Animated.View
      entering={FadeInDown.delay(50 * index).duration(280)}
      style={{
        marginBottom: 14,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {icon}
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
      <View style={{ paddingLeft: 2 }}>{children}</View>
    </Animated.View>
  );
}
