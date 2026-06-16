import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Calendar, Users, MapPin, Share2 } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface TripHeaderBannerProps {
  trip: {
    name: string;
    destination: string;
    start_date: string;
    end_date: string;
    member_count: number;
    cover_emoji?: string;
  };
  onShare?: () => void;
}

export function TripHeaderBanner({ trip, onShare }: TripHeaderBannerProps) {
  const colors = useThemeColors();
  const shareScale = useSharedValue(1);
  const shareAnim = useAnimatedStyle(() => ({ transform: [{ scale: shareScale.value }] }));

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const dayCount = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return (
    <View style={[styles.banner, { backgroundColor: colors.primary }]}>
      <View style={styles.topRow}>
        <Text style={styles.emoji}>{trip.cover_emoji ?? '⛳'}</Text>
        <View style={styles.titleBlock}>
          <Text style={[styles.tripName, { color: colors.textOnPrimary }]} numberOfLines={2}>
            {trip.name}
          </Text>
          <View style={styles.locationRow}>
            <MapPin size={13} color={colors.textOnPrimary} />
            <Text style={[styles.location, { color: colors.textOnPrimary }]} numberOfLines={1}>
              {trip.destination}
            </Text>
          </View>
        </View>
        {onShare && (
          <Animated.View style={shareAnim}>
            <Pressable
              onPress={onShare}
              onPressIn={() => { shareScale.value = withSpring(0.9); }}
              onPressOut={() => { shareScale.value = withSpring(1); }}
              accessibilityLabel="Share trip"
              accessibilityHint="Opens share options for this trip"
              accessibilityRole="button"
              style={[styles.shareBtn, { backgroundColor: colors.primaryMuted }]}
            >
              <Share2 size={18} color={colors.textOnPrimary} />
            </Pressable>
          </Animated.View>
        )}
      </View>

      <View style={[styles.statsRow, { borderTopColor: colors.primaryMuted }]}>
        <StatPill icon={<Calendar size={13} color={colors.textOnPrimary} />} label={`${dayCount} days`} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.primaryMuted }]} />
        <StatPill
          icon={<Calendar size={13} color={colors.textOnPrimary} />}
          label={`${formatDate(trip.start_date)}`}
          colors={colors}
        />
        <View style={[styles.divider, { backgroundColor: colors.primaryMuted }]} />
        <StatPill
          icon={<Users size={13} color={colors.textOnPrimary} />}
          label={`${trip.member_count} golfer${trip.member_count !== 1 ? 's' : ''}`}
          colors={colors}
        />
      </View>
    </View>
  );
}

function StatPill({
  icon,
  label,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.statPill}>
      {icon}
      <Text style={[styles.statLabel, { color: colors.textOnPrimary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  emoji: {
    fontSize: 36,
    marginTop: 2,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  tripName: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 13,
    opacity: 0.85,
    flex: 1,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 12,
    gap: 0,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
  divider: {
    width: 1,
    height: 16,
    opacity: 0.4,
  },
});
