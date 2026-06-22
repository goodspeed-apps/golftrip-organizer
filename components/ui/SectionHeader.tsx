/**
 * GAS Template, SectionHeader
 *
 * Reusable section header for settings-style screens.
 *
 * Renders an uppercase label with muted color and letter spacing,
 * matching the ThreadLift design language.
 *
 * Props:
 * - title: The section label text (rendered uppercase automatically)
 *
 * Usage:
 *   <SectionHeader title="Preferences" />
 *   <View>...settings rows...</View>
 *
 * Dependencies: useThemeColors (ThemeContext)
 */

import { Text, type TextStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface SectionHeaderProps {
  /** Section label text (rendered uppercase) */
  title: string;
  /** Optional style overrides for the label */
  style?: TextStyle;
}

/**
 * SectionHeader, Uppercase muted label for grouping settings rows.
 *
 * Designed for use above grouped card containers in settings/profile screens.
 * The DevAgent should use this component wherever settings sections are needed.
 */
export function SectionHeader({ title, style }: SectionHeaderProps) {
  const { colors } = useThemeColors();

  return (
    <Text
      style={[
        {
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginHorizontal: 20,
          marginBottom: 8,
        },
        style,
      ]}
    >
      {title}
    </Text>
  );
}
