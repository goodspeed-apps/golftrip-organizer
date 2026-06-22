import React from 'react';
import { Switch, Text, View } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Controller, type Control } from 'react-hook-form';
import { useThemeColors } from '@/context/ThemeContext';

interface FormSwitchProps {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  label: string;
  testID?: string;
}

export function FormSwitch({ name, control, label, testID }: FormSwitchProps) {
  const { colors } = useThemeColors();

  return (
    <Controller
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name={name as any}
      control={control}
      render={({ field: { onChange, value } }) => (
<View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{label}</Text>
          <Switch
            value={!!value}
            onValueChange={onChange}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
            testID={testID}
            accessibilityLabel={label}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!value }}
          />
        </View>
      )}
    />
  );
}