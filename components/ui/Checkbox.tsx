/**
 * GAS Template, Checkbox
 *
 * Themed checkbox with label, leveraging design system colors.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig, lucide-react-native
 */

import { TouchableOpacity, View, Text } from 'react-native';
import { Check } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

const primary = gasConfig.design.colors.primary;

interface CheckboxProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onToggle, label, disabled = false }: CheckboxProps) {
  const { colors } = useThemeColors();

  return (
    <TouchableOpacity
      onPress={() => !disabled && onToggle(!checked)}
      disabled={disabled}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: disabled ? 0.5 : 1 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? primary : colors.border,
          backgroundColor: checked ? primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />}
      </View>
      {label && (
        <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
