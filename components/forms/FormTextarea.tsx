/**
 * GAS Template, FormTextarea
 *
 * Like FormInput but multiline with numberOfLines={4}.
 * Controller-wrapped with label, error-on-touch, and a11y props.
 */

import React from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Controller, type Control } from 'react-hook-form';
import { useThemeColors } from '@/context/ThemeContext';
import { FieldLabel } from './_FieldLabel';
import { FieldError } from './_FieldError';

interface FormTextareaProps {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  label?: string;
  placeholder?: string;
  testID?: string;
}

export function FormTextarea({
  name,
  control,
  label,
  placeholder,
  testID,
}: FormTextareaProps) {
  const { colors } = useThemeColors();

  return (
    <Controller
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name={name as any}
      control={control}
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
              multiline
              numberOfLines={4}
              testID={testID}
              accessibilityLabel={label}
              style={[
                styles.textarea,
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
  textarea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});