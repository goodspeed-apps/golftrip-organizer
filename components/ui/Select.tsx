/**
 * GAS Template, Select
 *
 * Modal-based dropdown picker (no native dropdown in React Native).
 * Uses ModalContainer for the picker overlay.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig, ModalContainer, lucide-react-native
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';
import { radius } from '../../lib/design-tokens';
import { ModalContainer } from './ModalContainer';

const primary = gasConfig.design.colors.primary;

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export function Select({ options, value, onChange, placeholder = 'Select...', label, disabled = false }: SelectProps) {
  const { colors } = useThemeColors();
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

  return (
    <View>
      {label && (
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
          {label}
        </Text>
      )}

      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius(),
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.5 : 1,
        }}
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open, disabled }}
      >
        <Text style={{ color: value ? colors.text : colors.textSecondary, fontSize: 15 }}>
          {selectedLabel}
        </Text>
        <ChevronDown size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <ModalContainer visible={open} onClose={() => setOpen(false)} position="bottom" avoidKeyboard={false}>
        {label && (
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 16 }}>
            {label}
          </Text>
        )}
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => {
            const selected = item.value === value;
            return (
              <TouchableOpacity
                onPress={() => { onChange(item.value); setOpen(false); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  paddingHorizontal: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={{ color: selected ? primary : colors.text, fontSize: 15, fontWeight: selected ? '600' : '400' }}>
                  {item.label}
                </Text>
                {selected && <Check size={18} color={primary} />}
              </TouchableOpacity>
            );
          }}
          style={{ maxHeight: 300 }}
        />
      </ModalContainer>
    </View>
  );
}
