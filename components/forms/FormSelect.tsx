/**
 * GAS Template, FormSelect
 *
 * Controller-wrapped select component.
 * Opens a Modal with a FlatList of options on both native and web.
 */

import React, { useState } from 'react';
import { FlatList, Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Controller, type Control } from 'react-hook-form';
import { useThemeColors } from '@/context/ThemeContext';
import { FieldLabel } from './_FieldLabel';
import { FieldError } from './_FieldError';

interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectProps {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  testID?: string;
}

export function FormSelect({
  name,
  control,
  label,
  options,
  placeholder,
  testID,
}: FormSelectProps) {
  const { colors } = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <Controller
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name={name as any}
      control={control}
      render={({ field: { onChange, onBlur, value }, fieldState }) => {
        const selected = options.find(o => o.value === value);
        const showError = fieldState.isTouched && !!fieldState.error?.message;

        return (
          <View style={styles.container}>
            <FieldLabel label={label} />
            <TouchableOpacity
              onPress={() => setOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="combobox"
              accessibilityLabel={label}
              accessibilityState={{ expanded: open }}
              testID={testID}
              style={[
                styles.trigger,
                {
                  borderColor: showError ? colors.error : colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.text : colors.textSecondary,
                  fontSize: 15,
                }}
              >
                {selected?.label ?? placeholder ?? 'Select...'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>▼</Text>
            </TouchableOpacity>

            <FieldError error={fieldState.error?.message} visible={showError} />

            <Modal
              visible={open}
              transparent
              animationType="fade"
              onRequestClose={() => setOpen(false)}
              testID={testID ? `${testID}-modal` : undefined}
            >
              <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={() => { onBlur(); setOpen(false); }}
              >
                <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
                  <FlatList
                    data={options}
                    keyExtractor={item => item.value}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          onChange(item.value);
                          onBlur();
                          setOpen(false);
                        }}
                        accessibilityRole="menuitem"
                        accessibilityLabel={item.label}
                        testID={testID ? `${testID}-option-${item.value}` : undefined}
                        style={[
                          styles.option,
                          {
                            borderBottomColor: colors.border,
                            backgroundColor: item.value === value ? colors.primary + '22' : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: item.value === value ? colors.primary : colors.text,
                            fontSize: 15,
                            fontWeight: item.value === value ? '600' : '400',
                          }}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
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
  trigger: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 14,
    overflow: 'hidden',
    maxHeight: 360,
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});