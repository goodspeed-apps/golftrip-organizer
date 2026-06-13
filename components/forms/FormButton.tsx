import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface FormButtonProps {
  onPress: () => void;
  title: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  testID?: string;
}

export function FormButton({
  onPress,
  title,
  disabled,
  isSubmitting,
  testID,
}: FormButtonProps) {
  const { colors } = useThemeColors();
  const isDisabled = disabled || isSubmitting;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: isSubmitting }}
      testID={testID}
      className="h-12 rounded-xl items-center justify-center opacity-100 mt-2"
      style={{
        backgroundColor: colors.primary,
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {isSubmitting ? (
        <ActivityIndicator size="small" color={colors.textOnPrimary} testID={testID ? `${testID}-spinner` : undefined} />
      ) : (
        <Text className="text-white text-base font-bold">{title}</Text>
      )}
    </TouchableOpacity>
  );
}
