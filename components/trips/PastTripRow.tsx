import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { MapPin, Users, ChevronRight } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface PastTripRowProps {
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
  index?: number;
}

export function PastTripRow({ trip, onPress, index = 0 }: PastTripRowProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)}-${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  };

  return (
    <Animated.View
      entering={undefined}
      style={[animatedStyle, { marginHorizontal: 16, marginBottom: 10 }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        accessibilityLabel={`Past trip: ${trip.name}`}
        accessibilityHint="Opens trip details"
        accessibilityRole="button"
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
      >
        <View style={[styles.emojiBox, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={styles.emoji}>{trip.cover_emoji ?? '⛳'}</Text>
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {trip.name}
          </Text>
          <View style={styles.subRow}>
            <MapPin size={11} color={colors.textSecondary} />
            <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
              {trip.destination}
            </Text>
          </View>
          <View style={styles.subRow}>
            <Users size={11} color={colors.textMuted} />
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {trip.member_count} golfer{trip.member_count !== 1 ? 's' : ''} · {formatRange(trip.start_date, trip.end_date)}
            </Text>
          </View>
        </View>

        <ChevronRight size={18} color={colors.border} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
    minHeight: 72,
  },
  emojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sub: {
    fontSize: 12,
    flex: 1,
  },
  meta: {
    fontSize: 11,
  },
});
