import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useThemeColors();

  const isDisabled = disabled || loading;

  const getBackgroundColor = () => {
    if (isDisabled && variant === 'primary') return colors.border;
    switch (variant) {
      case 'primary': return colors.primary;
      case 'secondary': return colors.surface;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      case 'destructive': return colors.error;
      default: return colors.primary;
    }
  };

  const getTextColor = () => {
    if (isDisabled) return colors.textSecondary;
    switch (variant) {
      case 'primary': return '#FFFFFF';
      case 'secondary': return colors.text;
      case 'outline': return colors.primary;
      case 'ghost': return colors.primary;
      case 'destructive': return '#FFFFFF';
      default: return '#FFFFFF';
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'outline': return colors.primary;
      case 'secondary': return colors.border;
      default: return 'transparent';
    }
  };

  const getPadding = (): ViewStyle => {
    switch (size) {
      case 'sm': return { paddingVertical: 6, paddingHorizontal: 12 };
      case 'lg': return { paddingVertical: 16, paddingHorizontal: 24 };
      default: return { paddingVertical: 12, paddingHorizontal: 20 };
    }
  };

  const getFontSize = (): number => {
    switch (size) {
      case 'sm': return 13;
      case 'lg': return 17;
      default: return 15;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      activeOpacity={0.75}
      style={[
        styles.base,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0,
          opacity: isDisabled ? 0.6 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={getTextColor()}
        />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: getTextColor(),
              fontSize: getFontSize(),
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontWeight: '600',
  },
});
