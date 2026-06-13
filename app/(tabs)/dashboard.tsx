import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Plus, Flag } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { TripHeroCard } from '@/components/TripHeroCard';
import { PastTripRow } from '@/components/PastTripRow';
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

export default function DashboardScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [pastTrips, setPastTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const start = Date.now();
    try {
      setError(null);
      const end = trackApiLatency('fetch_trips');
      const today = new Date().toISOString().split('T')[0];

      const { data: memberRows, error: memberErr } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', user.id);
      if (memberErr) throw memberErr;

      const tripIds = (memberRows ?? []).map((r) => r.trip_id);
      if (tripIds.length === 0) {
        setUpcomingTrips([]);
        setPastTrips([]);
        end();
        return;
      }

      const { data, error: tripsErr } = await supabase
        .from('trips')
        .select('id, name, start_date, end_date, cover_image_url, status')
        .in('id', tripIds)
        .order('start_date', { ascending: true });
      if (tripsErr) throw tripsErr;

      end();
      const all = data ?? [];
      setUpcomingTrips(all.filter((t) => t.end_date >= today));
      setPastTrips(all.filter((t) => t.end_date < today));
      trackScreenLoad('Dashboard', start);
    } catch (err) {
      captureException(err as Error, { screen: 'Dashboard', action: 'fetchTrips' });
      setError("Couldn't load your trips. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    track('screen_view_dashboard', {});
    fetchTrips();
  }, [fetchTrips]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const handleCreateTrip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('tap_create_trip_fab', {});
    router.push('/(modal)/create-trip');
  };

  const handleLongPressPast = (trip: Trip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(trip.name, 'What would you like to do?', [
      { text: 'View Recap', onPress: () => track('tap_view_recap', { trip_id: trip.id }) },
      { text: 'Archive', style: 'destructive', onPress: () => track('tap_archive_trip', { trip_id: trip.id }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}><Text style={styles.greetingText}>Loading...</Text></View>
        <LoadingSkeleton variant="card" count={2} />
      </SafeAreaView>
    );
  }

  const hasAny = upcomingTrips.length > 0 || pastTrips.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={pastTrips}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
              <View>
                <Text style={styles.greetingText}>{greeting()},</Text>
                <Text style={styles.nameText}>{user?.user_metadata?.display_name ?? 'Golfer'} 🏌️</Text>
              </View>
            </Animated.View>

            {error && (
              <Animated.View entering={FadeInDown.delay(50)} style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <Text style={styles.sectionLabel}>Upcoming Trips</Text>
            </Animated.View>

            {upcomingTrips.length === 0 && !error ? (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <EmptyState
                  icon={<Flag size={40} color={colors.primary} />}
                  title="No trips on the calendar yet"
                  description="Create your first trip and invite your crew, it only takes a minute."
                  action={{ label: 'Create a Trip', onPress: handleCreateTrip }}
                />
              </Animated.View>
            ) : (
              upcomingTrips.map((trip, i) => (
                <Animated.View key={trip.id} entering={FadeInDown.delay(150 + i * 50).springify()}>
                  <TripHeroCard
                    trip={trip}
                    onPress={() => {
                      track('tap_trip_card', { trip_id: trip.id });
                      router.push(`/(tabs)/trip/${trip.id}/itinerary` as never);
                    }}
                  />
                </Animated.View>
              ))
            )}

            {pastTrips.length > 0 && (
              <Animated.View entering={FadeInDown.delay(300).springify()}>
                <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Past Trips</Text>
              </Animated.View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(350 + index * 50).springify()}>
            <PastTripRow
              trip={item}
              onPress={() => {
                track('tap_past_trip', { trip_id: item.id });
                router.push(`/(tabs)/trip/${item.id}/itinerary` as never);
              }}
              onLongPress={() => handleLongPressPast(item)}
            />
          </Animated.View>
        )}
        ListEmptyComponent={!hasAny && !error ? null : undefined}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        onPress={handleCreateTrip}
        accessibilityLabel="Create a new trip"
        accessibilityHint="Opens the trip creation form"
        style={({ pressed }) => [styles.fab, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Plus size={24} color={colors.textOnPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    listContent: { paddingBottom: 100, paddingHorizontal: spacing.md },
    header: { paddingTop: spacing.lg, paddingBottom: spacing.md },
    greetingText: { fontSize: 16, fontFamily: 'Manrope_400Regular', color: colors.textSecondary },
    nameText: { fontSize: 26, fontFamily: 'Outfit_700Bold', color: colors.text, marginTop: 2 },
    sectionLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
    errorCard: { backgroundColor: colors.warningMuted, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
    errorText: { fontFamily: 'Manrope_400Regular', color: colors.warning, fontSize: 14 },
    fab: { position: 'absolute', bottom: spacing.xl, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  });
