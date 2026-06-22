/**
 * GAS Template, FormCheckbox
 *
 * Controller-wrapped boolean checkbox.
 * Renders a touchable row with a bordered box (filled when checked) + label.
 */

import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Controller, type Control } from 'react-hook-form';
import { useThemeColors } from '@/context/ThemeContext';
import { FieldError } from './_FieldError';

interface FormCheckboxProps {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  label: string;
  testID?: string;
}

export function FormCheckbox({ name, control, label, testID }: FormCheckboxProps) {
  const { colors } = useThemeColors();

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    box: {
      width: 22,
      height: 22,
      borderRadius: 5,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmark: {
      color: colors.textOnPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    labelText: {
      fontSize: 15,
      flex: 1,
    },
  });

  return (
    <Controller
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name={name as any}
      control={control}
      render={({ field: { onChange, value }, fieldState }) => {
        const checked = !!value;
        const showError = fieldState.isTouched && !!fieldState.error?.message;
        return (
          <View style={styles.container}>
            <TouchableOpacity
              onPress={() => onChange(!checked)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={label}
              testID={testID}
              style={styles.row}
            >
              <View
                style={[
                  styles.box,
                  {
                    borderColor: checked ? colors.primary : colors.border,
                    backgroundColor: checked ? colors.primary : 'transparent',
                  },
                ]}
              >
                {checked ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : null}
              </View>
              <Text style={[styles.labelText, { color: colors.text }]}>{label}</Text>
            </TouchableOpacity>
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
