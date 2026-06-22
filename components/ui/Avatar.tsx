/**
 * GAS Template, Avatar
 *
 * Circular avatar with image, initials fallback, and size presets.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  /** Image URI */
  uri?: string | null;
  /** Fallback display name (used for initials) */
  name?: string;
  /** Size preset (default: md) */
  size?: AvatarSize;
  /** Accessibility label override */
  accessibilityLabel?: string;
  /**
   * Stable identity for this avatar within a virtualized list row (e.g. the
   * user/item id). Passed to expo-image's `recyclingKey` so a recycled row
   * clears the previous image instead of briefly showing the wrong one.
   */
  recyclingKey?: string;
}

const SIZE_MAP: Record<AvatarSize, { dim: number; fontSize: number }> = {
  sm: { dim: 32, fontSize: 12 },
  md: { dim: 40, fontSize: 15 },
  lg: { dim: 56, fontSize: 20 },
  xl: { dim: 80, fontSize: 28 },
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic color from name string */
function hashColor(name: string): string {
  // Stable user-identity palette, intentionally NOT theme-tokenized so a rebrand never shifts existing users' avatar colors.
  const palette = ['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316', '#EAB308', '#22C55E', '#06B6D4'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ uri, name, size = 'md', accessibilityLabel, recyclingKey }: AvatarProps) {
  const { colors } = useThemeColors();
  const s = SIZE_MAP[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: s.dim, height: s.dim, borderRadius: s.dim / 2 }}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ?? uri}
        accessibilityLabel={accessibilityLabel ?? name ?? 'Avatar'}
      />
    );
  }

  const initials = name ? getInitials(name) : '?';
  const bg = name ? hashColor(name) : colors.border;

  return (
    <View
      style={{
        width: s.dim,
        height: s.dim,
        borderRadius: s.dim / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={accessibilityLabel ?? name ?? 'Avatar'}
    >
      <Text style={{ color: '#FFFFFF', fontSize: s.fontSize, fontWeight: '700' }}>
        {initials}
      </Text>
    </View>
  );
}
