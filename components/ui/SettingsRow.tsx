/**
 * GAS Template, SettingsRow
 *
 * Reusable row component for settings/profile screens.
 *
 * Supports three right-side element types:
 * - Switch (toggle): pass `switchValue` and `onSwitchChange`
 * - Chevron (navigation): pass `onPress` without switch props
 * - Custom: pass `rightElement` for any custom React node
 *
 * Features:
 * - Icon with colored background circle (left side)
 * - Label and optional description
 * - Theme-aware colors via useThemeColors()
 * - Bottom border toggle for grouped rows
 * - Accessible press targets with labels
 *
 * Extracted from ThreadLift's profile.tsx row patterns, generalized for reuse.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig (for primary color)
 */

import { View, Text, TouchableOpacity, Switch, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

interface SettingsRowProps {
  /** Row label text */
  label: string;
  /** Optional description below the label */
  description?: string;
  /** Lucide icon component to render on the left */
  icon?: React.ElementType;
  /** Icon tint color (default: primary from gasConfig) */
  iconColor?: string;
  /** Icon background color (default: primary + 15% opacity) */
  iconBgColor?: string;
  /** Whether to show a bottom border (for grouped rows, default: true) */
  showBorder?: boolean;
  /** Disabled state, reduces opacity and blocks interaction */
  disabled?: boolean;
  /** Accessibility label override (defaults to `label`) */
  accessibilityLabel?: string;

  // --- Switch mode ---
  /** If provided, renders a Switch on the right */
  switchValue?: boolean;
  /** Called when the switch is toggled */
  onSwitchChange?: (value: boolean) => void;
  /** Switch active track color (default: primary + 80% opacity) */
  switchActiveColor?: string;

  // --- Navigation/press mode ---
  /** If provided (and no switchValue), renders as a pressable row with chevron */
  onPress?: () => void;

  // --- Custom right element ---
  /** Custom element to render on the right (overrides chevron) */
  rightElement?: React.ReactNode;

  // --- Badge / tag below label ---
  /** Badge text below description (e.g., "Pro only") */
  badge?: string;
  /** Badge text color */
  badgeColor?: string;

  /** Optional container style overrides */
  style?: ViewStyle;
}

/**
 * SettingsRow, Versatile settings row component.
 *
 * The DevAgent should use this for all settings-style list items.
 * Combine with SectionHeader for grouped sections.
 *
 * Usage examples:
 *
 *   // Toggle row:
 *   <SettingsRow
 *     label="Push Notifications"
 *     icon={Bell}
 *     switchValue={enabled}
 *     onSwitchChange={setEnabled}
 *   />
 *
 *   // Navigation row:
 *   <SettingsRow
 *     label="Alert Rules"
 *     icon={Sliders}
 *     iconColor="#F59E0B"
 *     onPress={() => router.push('/alerts')}
 *   />
 *
 *   // Row with badge:
 *   <SettingsRow
 *     label="Export CSV"
 *     icon={Download}
 *     iconColor="#22C55E"
 *     badge="Pro only"
 *     badgeColor="#F59E0B"
 *     onPress={handleExport}
 *   />
 */
export function SettingsRow({
  label,
  description,
  icon: Icon,
  iconColor,
  iconBgColor,
  showBorder = true,
  disabled = false,
  accessibilityLabel,
  switchValue,
  onSwitchChange,
  switchActiveColor,
  onPress,
  rightElement,
  badge,
  badgeColor,
  style,
}: SettingsRowProps) {
  const { colors } = useThemeColors();

  const primary = gasConfig.design.colors.primary;
  const resolvedIconColor = iconColor ?? primary;
  const resolvedIconBg = iconBgColor ?? resolvedIconColor + '15';
  const resolvedSwitchColor = switchActiveColor ?? primary + '80';

  const isSwitch = switchValue !== undefined;
  const isPressable = !!onPress && !isSwitch;

  // --- Inner content (shared between pressable and static variants) ---
  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderBottomWidth: showBorder ? 1 : 0,
          borderBottomColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {/* Icon circle */}
      {Icon && (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: resolvedIconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Icon size={18} color={resolvedIconColor} />
        </View>
      )}

      {/* Label + description + badge */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
        {description && (
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            {description}
          </Text>
        )}
        {badge && (
          <Text style={{ color: badgeColor ?? colors.warning, fontSize: 11, marginTop: 1 }}>
            {badge}
          </Text>
        )}
      </View>

      {/* Right element: switch, custom, or chevron */}
      {isSwitch && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled, checked: !!switchValue }}
          trackColor={{ false: colors.border, true: resolvedSwitchColor }}
          thumbColor={switchValue ? resolvedIconColor : colors.textSecondary}
        />
      )}
      {rightElement && !isSwitch && rightElement}
      {isPressable && !rightElement && (
        <ChevronRight size={18} color={colors.textSecondary} />
      )}
    </View>
  );

  // Wrap in TouchableOpacity if pressable
  if (isPressable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
