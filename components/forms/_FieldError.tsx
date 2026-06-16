import React from 'react';
import { Text } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface FieldErrorProps {
  error?: string;
  visible: boolean;
  testID?: string;
}

export function FieldError({ error, visible, testID }: FieldErrorProps) {
  const { colors } = useThemeColors();
  if (!visible || !error) return null;
  return (
    <Text
      style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      testID={testID}
    >
      {error}
    </Text>
  );
}