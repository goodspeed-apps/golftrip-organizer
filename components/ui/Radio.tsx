/**
 * GAS Template, RadioGroup
 *
 * Themed radio button group with outer circle + inner filled indicator.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { View, Text, TouchableOpacity } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

const primary = gasConfig.design.colors.primary;

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RadioGroup({ options, value, onChange, disabled = false }: RadioGroupProps) {
  const { colors } = useThemeColors();

  return (
    <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => !disabled && onChange(option.value)}
            disabled={disabled}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: disabled ? 0.5 : 1,
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: selected ? primary : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected && (
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: primary }} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                {option.label}
              </Text>
              {option.description && (
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                  {option.description}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
