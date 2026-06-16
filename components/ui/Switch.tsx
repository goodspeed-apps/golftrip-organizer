/**
 * GAS Template, Switch
 *
 * Themed switch wrapper with label and description.
 * Follows the SettingsRow pattern for consistent layout.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { View, Text, Switch as RNSwitch } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

const primary = gasConfig.design.colors.primary;

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ value, onValueChange, label, description, disabled = false }: SwitchProps) {
  const { colors } = useThemeColors();

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {description && (
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{description}</Text>
        )}
      </View>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: primary + '60' }}
        thumbColor={value ? primary : '#6B7280'}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
      />
    </View>
  );
}
