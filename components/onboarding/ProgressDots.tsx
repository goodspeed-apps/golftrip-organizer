import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface ProgressDotsProps {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: ProgressDotsProps) {
  const colors = useThemeColors();
  const s = styles(colors);
  return (
    <View style={s.container}>
      <View style={s.dotsRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[s.dot, i < current ? s.dotActive : s.dotInactive]}
          />
        ))}
      </View>
      <Text style={s.label}>{current} of {total}</Text>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    dotsRow: { flexDirection: 'row', gap: 6 },
    dot: { height: 6, borderRadius: 3 },
    dotActive: { width: 20, backgroundColor: colors.primary },
    dotInactive: { width: 6, backgroundColor: colors.border },
    label: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: colors.textMuted },
  });
