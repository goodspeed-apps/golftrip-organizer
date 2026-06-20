/**
 * GAS Template, Typography Scale
 *
 * Pre-styled text components matching the design system.
 * Heading, Subheading, Body, Caption, Label.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { Text, type TextProps, type TextStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';
import { displayFamily, bodyFamily } from '../../lib/fonts';

interface TypographyProps extends TextProps {
  /** Override text color */
  color?: string;
  /** Center text */
  center?: boolean;
}

const weight = gasConfig.design.typography.headingWeight;

export function Heading({ color, center, style, ...props }: TypographyProps) {
  const { colors } = useThemeColors();
  const family = displayFamily();
  const s: TextStyle = { color: color ?? colors.text, fontSize: 24, fontWeight: weight, textAlign: center ? 'center' : undefined, ...(family !== undefined ? { fontFamily: family } : {}) };
  return <Text style={[s, style]} accessibilityRole="header" {...props} />;
}

export function Subheading({ color, center, style, ...props }: TypographyProps) {
  const { colors } = useThemeColors();
  const family = displayFamily();
  const s: TextStyle = { color: color ?? colors.text, fontSize: 18, fontWeight: '600', textAlign: center ? 'center' : undefined, ...(family !== undefined ? { fontFamily: family } : {}) };
  return <Text style={[s, style]} {...props} />;
}

export function Body({ color, center, style, ...props }: TypographyProps) {
  const { colors } = useThemeColors();
  const family = bodyFamily();
  const s: TextStyle = { color: color ?? colors.text, fontSize: 15, lineHeight: 22, textAlign: center ? 'center' : undefined, ...(family !== undefined ? { fontFamily: family } : {}) };
  return <Text style={[s, style]} {...props} />;
}

export function Caption({ color, center, style, ...props }: TypographyProps) {
  const { colors } = useThemeColors();
  const family = bodyFamily();
  const s: TextStyle = { color: color ?? colors.textSecondary, fontSize: 12, textAlign: center ? 'center' : undefined, ...(family !== undefined ? { fontFamily: family } : {}) };
  return <Text style={[s, style]} {...props} />;
}

export function Label({ color, center, style, ...props }: TypographyProps) {
  const { colors } = useThemeColors();
  const family = bodyFamily();
  const s: TextStyle = { color: color ?? colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: center ? 'center' : undefined, ...(family !== undefined ? { fontFamily: family } : {}) };
  return <Text style={[s, style]} {...props} />;
}
