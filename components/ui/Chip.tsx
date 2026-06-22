/**
 * GAS Template, Chip
 *
 * Tag/chip component for filters, categories, and selections.
 *
 * Three visual states (canonical contrast recipe, codegen SHOULD copy this
 * pattern for any "M T W T F S S" day pickers, multi-select tag rows, etc.):
 *
 * - selected = solid primary background + textOnPrimary (white) text.
 *   Always readable regardless of how light or dark `primary` is.
 * - variant='filled' (unselected, decorative) = primary-tinted background
 *   + primary text. Used as a passive label, not as an interactive selection.
 * - variant='outlined' (unselected) = transparent background + textSecondary
 *   text + neutral border.
 *
 * The earlier implementation used the same tinted style for both 'filled'
 * decorative chips and selected chips, which made selected items unreadable
 * when `primary` was light enough that primary-on-primary-tint had no
 * contrast (observed in generated alarm screens: Mon-Fri pills looked blank).
 */

import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { X } from 'lucide-react-native';
import { useThemeColors } from '../../context/ThemeContext';
import { radius } from '../../lib/design-tokens';

export interface ChipProps {
  label: string;
  variant?: 'filled' | 'outlined';
  selected?: boolean;
  onPress?: () => void;
  onClose?: () => void;
}

export function Chip({ label, variant = 'filled', selected = false, onPress, onClose }: ChipProps) {
  const { colors } = useThemeColors();

  // Resolve the three states explicitly so contrast is guaranteed.
  let backgroundColor: string;
  let borderColor: string;
  let textColor: string;

  if (selected) {
    // Always-readable selected state: solid primary + white text.
    backgroundColor = colors.primary;
    borderColor = colors.primary;
    textColor = colors.textOnPrimary;
  } else if (variant === 'filled') {
    // Passive primary-tinted label.
    backgroundColor = colors.primary + '20';
    borderColor = colors.primary;
    textColor = colors.primary;
  } else {
    // Outlined unselected.
    backgroundColor = 'transparent';
    borderColor = colors.border;
    textColor = colors.textSecondary;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radius(),
        backgroundColor,
        borderWidth: 1,
        borderColor,
        gap: 6,
      }}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: textColor }}>
        {label}
      </Text>
      {onClose && (
        <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel={`Remove ${label}`}>
          <X size={12} color={textColor} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
