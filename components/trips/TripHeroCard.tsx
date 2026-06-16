import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Calendar, Users, MapPin, ArrowRight } from 'lucide-react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface TripHeroCardProps {
  trip: {
    id: string;
    name: string;
    destination: string;
    start_date: string;
    end_date: string;
    member_count: number;
    cover_emoji?: string;
  };
  onPress: () => void;
}

export function TripHeroCard({ trip, onPress }: TripHeroCardProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const startFmt = formatDate(trip.start_date);
  const endFmt = formatDate(trip.end_date);

  const daysUntil = Math.ceil(
    (new Date(trip.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Animated.View entering={FadeInDown.delay(50).springify()}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={() => { scale.value = withSpring(0.97); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          accessibilityLabel={`Open trip ${trip.name}`}
          accessibilityHint="Opens the full trip workspace"
          accessibilityRole="button"
          style={[styles.card, { backgroundColor: colors.primary, shadowColor: colors.shadow }]}
        >
          <View style={styles.topRow}>
            <Text style={styles.emoji}>{trip.cover_emoji ?? '⛳'}</Text>
            {daysUntil > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primaryMuted }]}>
                <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>
                  {daysUntil}d away
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.tripName, { color: colors.textOnPrimary }]} numberOfLines={2}>
            {trip.name}
          </Text>

          <View style={styles.detailRow}>
            <MapPin size={14} color={colors.textOnPrimary} />
            <Text style={[styles.detailText, { color: colors.textOnPrimary }]} numberOfLines={1}>
              {trip.destination}
            </Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.metaGroup}>
              <View style={styles.metaItem}>
                <Calendar size={13} color={colors.textOnPrimary} />
                <Text style={[styles.metaText, { color: colors.textOnPrimary }]}>
                  {startFmt}-{endFmt}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Users size={13} color={colors.textOnPrimary} />
                <Text style={[styles.metaText, { color: colors.textOnPrimary }]}>
                  {trip.member_count} golfer{trip.member_count !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <ArrowRight size={20} color={colors.textOnPrimary} />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  emoji: {
    fontSize: 36,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tripName: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 28,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  detailText: {
    fontSize: 14,
    opacity: 0.85,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaGroup: {
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    opacity: 0.9,
  },
});
