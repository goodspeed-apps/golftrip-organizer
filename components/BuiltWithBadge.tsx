import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';

export function BuiltWithBadge() {
  const insets = useSafeAreaInsets();
  const { colors, resolved } = useThemeColors();

  const onPress = () => {
    const slug = gasConfig.app?.slug ?? '';
    Linking.openURL(`https://goodspeed.app/built-with?ref=${encodeURIComponent(slug)}`);
  };

  // Sit inside the home-indicator/gesture region (below safe-area inset) so the
  // pill doesn't overlap tab bars or bottom action sheets. On Android without an
  // inset this collapses to bottom: 4.
  const bottomOffset = Math.max(insets.bottom - 24, 4);

  // Subtle, theme-aware pill: a faint elevated surface with a hairline border
  // and a secondary-text label, so it reads as chrome in both light and dark
  // schemes instead of a hard black-on-white block. Slightly more transparent
  // in dark mode so it recedes against deep backgrounds.
  const pillOpacity = resolved === 'dark' ? 0.85 : 0.92;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: bottomOffset }]}
    >
      <Pressable
        onPress={onPress}
        style={[
          styles.pill,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pillOpacity,
          },
        ]}
        accessibilityRole="link"
        accessibilityLabel="Built with Goodspeed"
      >
        <Text style={[styles.text, { color: colors.textSecondary }]}>Built with Goodspeed</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
});
