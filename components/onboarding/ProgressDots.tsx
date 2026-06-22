import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

type Props = {
  total: number;
  current: number;
  colors: ReturnType<typeof useThemeColors>;
};

export function ProgressDots({ total, current, colors }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (
        <View
          key={n}
          style={[
            styles.dot,
            { backgroundColor: n <= current ? colors.primary : colors.border },
            n === current && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
});
