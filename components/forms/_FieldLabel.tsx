import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface FieldLabelProps {
  label?: string;
}

export function FieldLabel({ label }: FieldLabelProps) {
  const { colors } = useThemeColors();
  if (!label) return null;
  return (
    <Text style={[styles.label, { color: colors.text }]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
});