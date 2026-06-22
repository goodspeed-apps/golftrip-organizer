/**
 * GAS Template, DayOfWeekPicker
 *
 * Seven-pill row for picking one or more days of the week. Designed for
 * alarm/reminder/habit apps where the user picks repeat days. Selected
 * pills use solid primary + textOnPrimary so contrast is unambiguous
 * regardless of how light or dark `primary` is in the active theme.
 *
 * Values map: Sunday=0, Monday=1, ..., Saturday=6 (JS Date.getDay()).
 *
 * Usage:
 *   const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]); // weekdays
 *   <DayOfWeekPicker value={days} onChange={setDays} />
 *
 * Codegen note: this is the canonical day-picker. Do not re-invent
 * Mon-Tue-Wed pills inline, import this component instead.
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useThemeColors } from '../../context/ThemeContext';

export interface DayOfWeekPickerProps {
  /** Selected day indices (0 = Sunday, 1 = Monday, ..., 6 = Saturday). */
  value: number[];
  /** Called with the new selected-day array whenever a pill is toggled. */
  onChange: (next: number[]) => void;
  /** Override the first day of the week. 0 = Sunday (default), 1 = Monday. */
  firstDay?: 0 | 1;
  /** Accessibility label for the whole control. */
  accessibilityLabel?: string;
}

const LABELS_SUN_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function DayOfWeekPicker({
  value,
  onChange,
  firstDay = 0,
  accessibilityLabel = 'Days of week',
}: DayOfWeekPickerProps) {
  const { colors } = useThemeColors();

  const ordered = firstDay === 1
    ? [1, 2, 3, 4, 5, 6, 0] // Mon → Sun
    : [0, 1, 2, 3, 4, 5, 6]; // Sun → Sat

  const toggle = useCallback((day: number) => {
    const isOn = value.includes(day);
    const next = isOn ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b);
    onChange(next);
  }, [value, onChange]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}
    >
      {ordered.map((day) => {
        const selected = value.includes(day);
        const label = LABELS_SUN_FIRST[day];
        const full = FULL_NAMES[day];
        return (
          <TouchableOpacity
            key={day}
            onPress={() => toggle(day)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={full}
            style={{
              flex: 1,
              aspectRatio: 1,
              minHeight: 44,
              minWidth: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              borderWidth: 1,
              backgroundColor: selected ? colors.primary : 'transparent',
              borderColor: selected ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: selected ? colors.textOnPrimary : colors.text,
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
