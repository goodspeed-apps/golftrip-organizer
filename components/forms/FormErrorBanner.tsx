import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface FormErrorBannerProps {
  error: string | null;
  testID?: string;
}

export function FormErrorBanner({ error, testID }: FormErrorBannerProps) {
  const { colors } = useThemeColors();

  if (!error) return null;

  const bannerBg = colors.errorMuted;
  const bannerText = colors.error;

  return (
    <View
      style={{
        backgroundColor: bannerBg,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.error,
      }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID ?? 'form-error-banner'}
    >
      <Text style={{ color: bannerText, fontSize: 14, fontWeight: '500' }}>{error}</Text>
    </View>
  );
}