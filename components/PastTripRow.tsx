import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { MapPin, Flag, Users, ChevronRight } from 'lucide-react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

export interface PastTripData {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  memberCount: number;
  roundsPlayed: number;
  totalSpend: number | null;
}

interface PastTripRowProps {
  trip: PastTripData;
  onPress: () => void;
  index?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PastTripRow({ trip, onPress }: PastTripRowProps) {
  const colors = useThemeColors();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1, { damping: 14, stiffness: 200 }) }],
  }));

  const year = new Date(trip.startDate).getFullYear();
  const startMonth = new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short' });
  const endMonth = new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateLabel = `${startMonth}-${endMonth}, ${year}`;

  const spendLabel =
    trip.totalSpend != null
      ? `$${(trip.totalSpend ?? 0).toFixed(0)} total`
      : 'No expenses recorded';

  return (
    <AnimatedPressable
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
        animStyle,
      ]}
      onPress={onPress}
      accessibilityLabel={`Past trip: ${trip.name} in ${trip.destination}`}
      accessibilityHint="Opens trip details"
      accessibilityRole="button"
    >
      <View style={[styles.iconWrapper, { backgroundColor: colors.secondaryMuted }]}>
        <Flag size={20} color={colors.secondary} />
      </View>

      <View style={styles.content}>
        <Text
          style={[styles.name, { color: colors.text, fontFamily: 'PlusJakartaSans_700Bold' }]}
          numberOfLines={1}
        >
          {trip.name}
        </Text>

        <View style={styles.metaRow}>
          <MapPin size={12} color={colors.textSecondary} />
          <Text style={[styles.meta, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {trip.destination}
          </Text>
          <Text style={[styles.metaSep, { color: colors.divider }]}>·</Text>
          <Text style={[styles.meta, { color: colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {dateLabel}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Users size={12} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textMuted, fontFamily: 'Inter_400Regular' }]}>
              {trip.memberCount} golfer{trip.memberCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.stat}>
            <Flag size={12} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textMuted, fontFamily: 'Inter_400Regular' }]}>
              {trip.roundsPlayed} round{trip.roundsPlayed !== 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={[styles.spend, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
            {spendLabel}
          </Text>
        </View>
      </View>

      <ChevronRight size={18} color={colors.textSecondary} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
    minHeight: 80,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaSep: {
    fontSize: 12,
    marginHorizontal: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
  },
  spend: {
    fontSize: 12,
    marginLeft: 'auto',
  },
});
