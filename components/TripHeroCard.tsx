import React from 'react';
import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Users, Calendar } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, BorderRadius } from '@/lib/theme';
import type { TripWithMemberCount } from '@/types/golf';

type Props = {
  trip: TripWithMemberCount;
  onPress: () => void;
  onLongPress: () => void;
  index: number;
};

function daysUntil(date: string): number {
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)}-${e.toLocaleDateString('en-US', opts)}`;
}

export function TripHeroCard({ trip, onPress, onLongPress, index }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const days = daysUntil(trip.start_date);

  return (
    <Animated.View style={[animStyle, styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        accessibilityLabel={`Trip: ${trip.name}`}
        accessibilityHint="Tap to open trip workspace"
        testID={`trip-card-${trip.id}`}
        style={[styles.card, { backgroundColor: colors.surface, borderRadius: BorderRadius.xl }]}
      >
        <View style={styles.imageWrapper}>
          {trip.cover_image_url ? (
            <Image source={{ uri: trip.cover_image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.imageFallback, { backgroundColor: colors.primary }]} />
          )}
          <View style={[styles.daysBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.daysText, { color: colors.textOnPrimary }]}>
              {days === 0 ? "Today!" : `${days}d`}
            </Text>
          </View>
        </View>
        <View style={[styles.info, { padding: Spacing.md }]}>
          <Text style={[styles.tripName, { color: colors.text }]} numberOfLines={1}>{trip.name}</Text>
          <View style={styles.meta}>
            <Calendar size={13} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {formatDateRange(trip.start_date, trip.end_date)}
            </Text>
            <Users size={13} color={colors.textSecondary} style={{ marginLeft: Spacing.sm }} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {trip.member_count}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginRight: Spacing.md, width: 240 },
  card: { overflow: 'hidden', elevation: 2 },
  imageWrapper: { position: 'relative', height: 140 },
  image: { width: '100%', height: '100%' },
  imageFallback: { width: '100%', height: '100%' },
  daysBadge: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  daysText: { fontSize: 11, fontFamily: 'Outfit_700Bold' },
  info: {},
  tripName: { fontSize: 15, fontFamily: 'Outfit_700Bold', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontFamily: 'Manrope_400Regular' },
});
