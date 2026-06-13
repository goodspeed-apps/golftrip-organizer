import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface FormErrorBannerProps {
  error: string | null;
  testID?: string;
}

export function FormErrorBanner({ error, testID }: FormErrorBannerProps) {
  const { colors, resolved } = useThemeColors();

  if (!error) return null;

  const bannerBg = resolved === 'dark' ? '#7f1d1d' : '#fee2e2';
  const bannerText = resolved === 'dark' ? '#fca5a5' : '#991b1b';

  return (
    <View
      style={{
        backgroundColor: bannerBg,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.error ?? '#EF4444',
      }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID ?? 'form-error-banner'}
    >
      <Text style={{ color: bannerText, fontSize: 14, fontWeight: '500' }}>{error}</Text>
    </View>
  );
}