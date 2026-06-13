import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { TripHeroCard } from '@/components/TripHeroCard';
import { PastTripRow } from '@/components/PastTripRow';
import { fetchUserTrips } from '@/services/tripService';
import { TripWithMemberCount } from '@/types/app';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { Spacing, BorderRadius } from '@/lib/theme';

export default function DashboardScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [upcoming, setUpcoming] = useState<TripWithMemberCount[]>([]);
  const [past, setPast] = useState<TripWithMemberCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const startTime = React.useRef(Date.now());

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setError(null);
    try {
      const { upcoming: u, past: p } = await fetchUserTrips(user.id);
      setUpcoming(u);
      setPast(p);
      trackScreenLoad('dashboard', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'dashboard', action: 'load' });
      setError("Couldn't load your trips. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    track('screen_view_dashboard');
    load();
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleLongPress = (trip: TripWithMemberCount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('trip_long_press', { trip_id: trip.id });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.user_metadata?.display_name?.split(' ')[0] ?? 'Golfer';

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <LoadingSkeleton width={200} height={28} />
        </View>
        <View style={{ padding: Spacing.lg }}>
          <LoadingSkeleton width="100%" height={180} style={{ borderRadius: BorderRadius.xl, marginBottom: Spacing.md }} />
          <LoadingSkeleton width="100%" height={64} style={{ borderRadius: BorderRadius.lg, marginBottom: Spacing.sm }} />
          <LoadingSkeleton width="100%" height={64} style={{ borderRadius: BorderRadius.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: Spacing.xl * 2 }}
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting()},</Text>
          <Text style={[styles.name, { color: colors.text }]}>{firstName} ⛳</Text>
        </Animated.View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.warningMuted, borderRadius: BorderRadius.lg, marginHorizontal: Spacing.lg }]}>
            <Text style={[styles.errorText, { color: colors.warning }]}>{error}</Text>
          </View>
        )}

        {upcoming.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: Spacing.lg }]}>Upcoming Trips</Text>
            <FlatList
              data={upcoming}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
              renderItem={({ item, index }) => (
                <TripHeroCard
                  trip={item}
                  index={index}
                  onPress={() => {
                    track('trip_card_tap', { trip_id: item.id });
                    router.push(`/(tabs)/trip/${item.id}/itinerary` as never);
                  }}
                />
              )}
            />
          </Animated.View>
        ) : (
          !error && (
            <Animated.View entering={FadeInDown.delay(60).springify()} style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}>
              <EmptyState
                icon="map"
                title="No upcoming trips yet"
                description="Tap the + button below to plan your first round with the crew!"
                actionLabel="Create a Trip"
                onAction={() => router.push('/(modal)/create-trip' as never)}
              />
            </Animated.View>
          )
        )}

        {past.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ marginTop: Spacing.lg, paddingHorizontal: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Past Trips</Text>
            {past.map((trip, index) => (
              <PastTripRow
                key={trip.id}
                trip={trip}
                index={index}
                onPress={() => {
                  track('past_trip_tap', { trip_id: trip.id });
                  router.push(`/(tabs)/trip/${trip.id}/itinerary` as never);
                }}
                onLongPress={() => handleLongPress(trip)}
              />
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          track('create_trip_fab_tap');
          router.push('/(modal)/create-trip' as never);
        }}
        accessibilityLabel="Create new trip"
        accessibilityHint="Opens the trip creation form"
      >
        <Plus size={26} color={colors.textOnPrimary} strokeWidth={2} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  greeting: { fontFamily: 'Manrope_400Regular', fontSize: 14 },
  name: { fontFamily: 'Outfit_700Bold', fontSize: 28 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, marginBottom: Spacing.md },
  errorBox: { padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { fontFamily: 'Manrope_400Regular', fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
});
