import { View, Text, TouchableOpacity } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

interface EmptyStateProps {
  /** Lucide icon component (icon={Inbox}) or kebab-case name (icon="inbox"). */
  icon?: React.ElementType | string;
  /** Icon color (default: textSecondary from theme) */
  iconColor?: string;
  /** Icon size (default: 48) */
  iconSize?: number;
  /** Title text */
  title: string;
  /** Description text below the title */
  description?: string;
  /** Alias for `description` (some callers use subtitle) */
  subtitle?: string;
  /** Optional action button label (use with onAction) */
  actionLabel?: string;
  /** Callback when the action button is pressed (use with actionLabel) */
  onAction?: () => void;
  /** Optional action as an object ({ label, onPress }) */
  action?: { label: string; onPress: () => void };
}

/** Convert a kebab-case icon name ("alert-circle") to PascalCase ("AlertCircle"). */
function kebabToPascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * True only for things React can actually render as an element type: a function
 * component, or a forwardRef/memo object (which carries a React `$$typeof`
 * symbol). The lucide-react-native namespace also holds non-component exports,
 * so a name lookup can return a plain object, rendering that throws "Element
 * type is invalid: … but got: object" and takes down the whole screen. Guarding
 * here degrades a bad/unknown icon name to no icon instead of a crash.
 */
export function isRenderableComponent(c: unknown): c is React.ElementType {
  if (typeof c === 'function') return true;
  return typeof c === 'object' && c !== null && '$$typeof' in (c as Record<string, unknown>);
}

/** Resolve the icon prop to a renderable component, or null if unavailable. */
export function resolveIcon(icon?: React.ElementType | string): React.ElementType | null {
  if (!icon) return null;
  const candidate =
    typeof icon === 'string'
      ? (LucideIcons as unknown as Record<string, unknown>)[kebabToPascal(icon)]
      : icon;
  return isRenderableComponent(candidate) ? candidate : null;
}

/**
 * EmptyState, Centered placeholder for empty lists/screens.
 *
 * Usage:
 *   <EmptyState icon={Inbox} title="No items yet" description="…" />
 *   <EmptyState icon="alert-circle" title="Something went wrong"
 *     subtitle={error} action={{ label: 'Retry', onPress: load }} />
 */
export function EmptyState({
  icon,
  iconColor,
  iconSize = 48,
  title,
  description,
  subtitle,
  actionLabel,
  onAction,
  action,
}: EmptyStateProps) {
  const { colors } = useThemeColors();
  const primary = gasConfig.design.colors.primary;

  const Icon = resolveIcon(icon);
  const body = description ?? subtitle;
  const btnLabel = actionLabel ?? action?.label;
  const btnPress = onAction ?? action?.onPress;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingVertical: 48,
      }}
    >
      {/* Icon */}
      {Icon && (
        <View style={{ marginBottom: 16 }}>
          <Icon size={iconSize} color={iconColor ?? colors.textSecondary} />
        </View>
      )}

      {/* Title */}
      <Text
        style={{
          color: colors.text,
          fontSize: 18,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>

      {/* Description */}
      {body && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: btnLabel ? 24 : 0,
          }}
        >
          {body}
        </Text>
      )}

      {/* Action button */}
      {btnLabel && btnPress && (
        <TouchableOpacity
          onPress={btnPress}
          accessibilityLabel={btnLabel}
          accessibilityRole="button"
          style={{
            backgroundColor: primary,
            borderRadius: 14,
            paddingHorizontal: 24,
            paddingVertical: 14,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
            {btnLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}