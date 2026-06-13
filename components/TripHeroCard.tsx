import React from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { MapPin, Calendar, Users, ChevronRight, Flag } from 'lucide-react-native';
import Animated, { FadeInDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export interface TripHeroData {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  memberCount: number;
  coverImageUrl?: string | null;
  daysUntil: number | null;
  status: 'upcoming' | 'active' | 'past';
  roundsBooked: number;
}

interface TripHeroCardProps {
  trip: TripHeroData;
  onPress: () => void;
}

function StatusBadge({ status, daysUntil }: { status: TripHeroData['status']; daysUntil: number | null }) {
  const colors = useThemeColors();

  const badgeColor =
    status === 'active'
      ? colors.success
      : status === 'upcoming'
      ? colors.primary
      : colors.textSecondary;

  const label =
    status === 'active'
      ? "You're on the course! 🏌️"
      : status === 'upcoming' && daysUntil !== null
      ? daysUntil === 0
        ? 'Tee off today! 🎉'
        : daysUntil === 1
        ? 'Tomorrow! 🚀'
        : `${daysUntil} days away`
      : 'Completed';

  return (
    <View style={[styles.badge, { backgroundColor: badgeColor }]}>
      <Text style={[styles.badgeText, { color: colors.textOnPrimary, fontFamily: 'Inter_600SemiBold' }]}>
        {label}
      </Text>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TripHeroCard({ trip, onPress }: TripHeroCardProps) {
  const colors = useThemeColors();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1, { damping: 14, stiffness: 180 }) }],
  }));

  const handlePressIn = () => {};

  return (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      <AnimatedPressable
        style={[styles.card, { shadowColor: colors.shadow }, animStyle]}
        onPress={onPress}
        onPressIn={handlePressIn}
        accessibilityLabel={`Trip to ${trip.destination}: ${trip.name}`}
        accessibilityHint="Opens trip workspace"
        accessibilityRole="button"
      >
        {trip.coverImageUrl ? (
          <ImageBackground
            source={{ uri: trip.coverImageUrl }}
            style={styles.heroBg}
            imageStyle={styles.heroBgImage}
          >
            <View style={[styles.heroOverlay, { backgroundColor: colors.surfaceDark }]}>
              <HeroContent trip={trip} colors={colors} />
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.heroBg, styles.heroBgFallback, { backgroundColor: colors.primaryMuted }]}>
            <HeroContent trip={trip} colors={colors} />
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

function HeroContent({
  trip,
  colors,
}: {
  trip: TripHeroData;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const startFormatted = new Date(trip.startDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endFormatted = new Date(trip.endDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.heroContent}>
      <View style={styles.heroTop}>
        <StatusBadge status={trip.status} daysUntil={trip.daysUntil} />
        <ChevronRight size={20} color={colors.textOnPrimary} />
      </View>

      <View style={styles.heroFlag}>
        <Flag size={28} color={colors.textOnPrimary} />
      </View>

      <Text
        style={[styles.tripName, { color: colors.textOnPrimary, fontFamily: 'PlusJakartaSans_700Bold' }]}
        numberOfLines={2}
      >
        {trip.name}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MapPin size={14} color={colors.textOnPrimary} />
          <Text style={[styles.metaText, { color: colors.textOnPrimary, fontFamily: 'Inter_400Regular' }]}>
            {trip.destination}
          </Text>
        </View>
        <View style={styles.metaDot} />
        <View style={styles.metaItem}>
          <Calendar size={14} color={colors.textOnPrimary} />
          <Text style={[styles.metaText, { color: colors.textOnPrimary, fontFamily: 'Inter_400Regular' }]}>
            {startFormatted}-{endFormatted}
          </Text>
        </View>
      </View>

      <View style={styles.heroFooter}>
        <View style={[styles.statChip, { backgroundColor: colors.surface }]}>
          <Users size={13} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
            {trip.memberCount} golfer{trip.memberCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.surface }]}>
          <Flag size={13} color={colors.accent} />
          <Text style={[styles.statText, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
            {trip.roundsBooked} round{trip.roundsBooked !== 1 ? 's' : ''} booked
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  heroBg: {
    minHeight: 220,
  },
  heroBgImage: {
    borderRadius: 20,
  },
  heroBgFallback: {
    borderRadius: 20,
  },
  heroOverlay: {
    flex: 1,
    borderRadius: 20,
    opacity: 0.88,
    minHeight: 220,
  },
  heroContent: {
    padding: 20,
    minHeight: 220,
    justifyContent: 'space-between',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFlag: {
    marginVertical: 8,
  },
  tripName: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    opacity: 0.9,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  heroFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    opacity: 0.95,
  },
  statText: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
  },
});
