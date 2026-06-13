import React from 'react';
import { View, Text, Pressable, ImageBackground, StyleSheet } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { Calendar, Users } from 'lucide-react-native';
import { TripWithMemberCount } from '@/types/app';
import { Spacing, BorderRadius } from '@/lib/theme';

interface Props {
  trip: TripWithMemberCount;
  onPress: () => void;
  index: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TripHeroCard({ trip, onPress, index }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 15 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 15 }); };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const daysLabel = trip.days_until === 0 ? "Today!" : trip.days_until === 1 ? "Tomorrow" : `${trip.days_until}d away`;

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 80).springify()}
      style={[styles.card, animStyle, { borderRadius: BorderRadius.xl }]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={`Trip: ${trip.name}`}
      accessibilityHint="Tap to open trip workspace"
    >
      <ImageBackground
        source={trip.cover_image_url ? { uri: trip.cover_image_url } : require('@/assets/images/course-default.png')}
        style={styles.image}
        imageStyle={{ borderRadius: BorderRadius.xl }}
      >
        <View style={[styles.overlay, { borderRadius: BorderRadius.xl }]} />
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: colors.text }]}>{daysLabel}</Text>
        </View>
        <View style={styles.content}>
          <Text style={[styles.tripName, { color: colors.textOnPrimary }]} numberOfLines={1}>{trip.name}</Text>
          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <Calendar size={14} color={colors.textOnPrimary} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textOnPrimary }]}>
                {fmt(trip.start_date)}-{fmt(trip.end_date)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Users size={14} color={colors.textOnPrimary} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textOnPrimary }]}>{trip.member_count} golfers</Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 280, marginRight: Spacing.md, overflow: 'hidden' },
  image: { height: 180, justifyContent: 'flex-end' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  badge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  badgeText: { fontFamily: 'Manrope_700Bold', fontSize: 11 },
  content: { padding: Spacing.md },
  tripName: { fontFamily: 'Outfit_700Bold', fontSize: 20, marginBottom: Spacing.xs },
  meta: { gap: Spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText: { fontFamily: 'Manrope_400Regular', fontSize: 12 },
});
