/**
 * GAS Template, Input
 *
 * Themed text input with label, error state, icon, and character count.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { useState, useRef } from 'react';
import { View, Text, TextInput, type TextInputProps, type ViewStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Label displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Helper text displayed below the input (hidden when error is present) */
  helperText?: string;
  /** Lucide icon component to show on the left */
  icon?: React.ElementType;
  /** Max character count (shows counter when set) */
  maxLength?: number;
  /** Additional container style */
  containerStyle?: ViewStyle;
  /** Make input fill available height (multiline) */
  multiline?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  icon: Icon,
  maxLength,
  containerStyle,
  value,
  onChangeText,
  ...rest
}: InputProps) {
  const { colors } = useThemeColors();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const borderColor = error
    ? gasConfig.design.colors.error
    : focused
      ? gasConfig.design.colors.primary
      : colors.border;

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor,
          borderRadius: 12,
          paddingHorizontal: 14,
          minHeight: rest.multiline ? 100 : 48,
        }}
      >
        {Icon && (
          <Icon
            size={18}
            color={focused ? gasConfig.design.colors.primary : colors.textSecondary}
            style={{ marginRight: 10 }}
            accessible={false}
            importantForAccessibility="no"
          />
        )}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={colors.textSecondary}
          maxLength={maxLength}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: 15,
            paddingVertical: 12,
            textAlignVertical: rest.multiline ? 'top' : 'center',
          }}
          // RN's AccessibilityState has no `invalid` field, so surface the
          // invalid state by folding the error into the field's label.
          accessibilityLabel={
            error
              ? `${label || rest.placeholder || ''}, invalid. ${error}`
              : (label || rest.placeholder)
          }
          {...rest}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {error ? (
          <Text
            style={{ color: gasConfig.design.colors.error, fontSize: 12 }}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {error}
          </Text>
        ) : helperText ? (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{helperText}</Text>
        ) : (
          <View />
        )}
        {maxLength != null && (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {(value?.length ?? 0)}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
}
