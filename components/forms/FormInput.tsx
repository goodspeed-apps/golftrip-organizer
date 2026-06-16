/**
 * GAS Template, FormInput
 *
 * Controller-wrapped TextInput with label, error-on-touch, and a11y props.
 * Uses useThemeColors for theme-aware colors.
 */

import React from 'react';
import { TextInput, View, StyleSheet, type KeyboardTypeOptions } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Controller, type Control, type RegisterOptions } from 'react-hook-form';
import { useThemeColors } from '@/context/ThemeContext';
import { FieldLabel } from './_FieldLabel';
import { FieldError } from './_FieldError';

interface FormInputProps {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  label?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: string;
  testID?: string;
  rules?: RegisterOptions;
}

export function FormInput({
  name,
  control,
  label,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoComplete,
  testID,
  rules,
}: FormInputProps) {
  const { colors } = useThemeColors();

  return (
    <Controller
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name={name as any}
      control={control}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rules={rules as any}
      render={({ field: { onChange, onBlur, value }, fieldState }) => {
        const showError = fieldState.isTouched && !!fieldState.error?.message;
        return (
          <View style={styles.container}>
            <FieldLabel label={label} />
            <TextInput
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={secureTextEntry}
              keyboardType={keyboardType}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              autoComplete={autoComplete as any}
              testID={testID}
              // RN's AccessibilityState has no `invalid` field, so surface the
              // invalid state by folding the error into the field's label.
              accessibilityLabel={
                showError && fieldState.error?.message
                  ? `${label ?? placeholder ?? ''}, invalid. ${fieldState.error.message}`
                  : label
              }
              style={[
                styles.input,
                {
                  borderColor: showError ? colors.error : colors.border,
                  color: colors.text,
                  backgroundColor: colors.surface,
                },
              ]}
            />
            <FieldError
              error={fieldState.error?.message}
              visible={showError}
              testID={testID ? `${testID}-error` : undefined}
            />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});