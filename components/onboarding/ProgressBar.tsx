import React from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const colors = useThemeColors();
  const pct = (current / total) * 100;

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 16, gap: 6 }}>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: 4,
            width: `${pct}%`,
            borderRadius: 2,
            backgroundColor: colors.primary,
          }}
        />
      </View>
      <Text
        style={{
          fontFamily: 'Manrope_400Regular',
          fontSize: 12,
          color: colors.textSecondary,
          textAlign: 'right',
        }}
      >
        Step {current} of {total}
      </Text>
    </View>
  );
}
