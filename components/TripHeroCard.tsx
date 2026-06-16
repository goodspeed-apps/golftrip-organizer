import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Calendar, Users } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, BorderRadius } from '@/lib/theme';

const spacing = Spacing;
const radii = BorderRadius;

interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  status: string;
  member_count?: number;
}

interface Props {
  trip: Trip;
  onPress: () => void;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)}-${e.toLocaleDateString('en-US', opts)}`;
}

export function TripHeroCard({ trip, onPress }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 15, stiffness: 200 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); };

  const days = daysUntil(trip.start_date);
  const badgeLabel = days === 0 ? "Today!" : days === 1 ? "Tomorrow!" : days > 0 ? `${days}d away` : "In progress";
  const styles = makeStyles(colors);

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={`Trip: ${trip.name}`}
        accessibilityHint="Tap to open trip workspace"
        style={styles.pressable}
      >
        <View style={styles.imageContainer}>
          {trip.cover_image_url ? (
            <Image source={{ uri: trip.cover_image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderEmoji}>⛳</Text>
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
          <View style={styles.metaRow}>
            <Calendar size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
          </View>
          {(trip.member_count ?? 0) > 0 && (
            <View style={styles.metaRow}>
              <Users size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{trip.member_count} members</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: radii.xl, marginBottom: spacing.md, overflow: 'hidden', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
    pressable: { flex: 1 },
    imageContainer: { position: 'relative', height: 160 },
    image: { width: '100%', height: 160 },
    imagePlaceholder: { backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    placeholderEmoji: { fontSize: 48 },
    badge: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: colors.primary, borderRadius: radii.xl, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    badgeText: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: colors.textOnPrimary },
    content: { padding: spacing.md, gap: spacing.xs },
    tripName: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    metaText: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary },
  });
