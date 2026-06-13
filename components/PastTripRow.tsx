import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { TripWithMemberCount } from '@/types/app';
import { Spacing, BorderRadius } from '@/lib/theme';

interface Props {
  trip: TripWithMemberCount;
  onPress: () => void;
  onLongPress: () => void;
  index: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PastTripRow({ trip, onPress, onLongPress, index }: Props) {
  const colors = useThemeColors();
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 50).springify()}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, { backgroundColor: colors.card, borderRadius: BorderRadius.lg, borderColor: colors.border }]}
      accessibilityLabel={`Past trip: ${trip.name}`}
      accessibilityHint="Tap to view, long press for options"
    >
      <View style={[styles.iconBox, { backgroundColor: colors.primaryMuted }]}>
        <MapPin size={18} color={colors.primary} strokeWidth={1.5} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{trip.name}</Text>
        <Text style={[styles.dates, { color: colors.textSecondary }]}>
          {fmt(trip.start_date)} · {trip.member_count} golfers
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} strokeWidth={1.5} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  info: { flex: 1 },
  name: { fontFamily: 'Manrope_600SemiBold', fontSize: 15 },
  dates: { fontFamily: 'Manrope_400Regular', fontSize: 13, marginTop: 2 },
});
