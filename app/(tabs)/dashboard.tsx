import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  FadeInDown,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Plus, Flag } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { TripHeroCard } from '@/components/trips/TripHeroCard';
import { PastTripRow } from '@/components/trips/PastTripRow';
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
  member_limit: number;
  invite_code: string;
  organizer_id: string;
  recap_unlocked: boolean;
  created_at: string;
  memberCount?: number;
  destination?: string;
  member_count?: number;
}

export default function DashboardScreen() {
  const themeContext = useThemeColors();
  const colors = themeContext.colors;
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [upcoming, setUpcoming] = useState<Trip[]>([]);
  const [past, setPast] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fabScale = useSharedValue(1);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const fetchTrips = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const start = Date.now();
    try {
      setError(null);
      const end = trackApiLatency('fetch_trips');
      const { data: memberRows, error: memberErr } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', user.id);
      end();
      if (memberErr) throw memberErr;

      const tripIds = (memberRows ?? []).map((r) => r.trip_id);
      if (tripIds.length === 0) {
        setUpcoming([]);
        setPast([]);
        trackScreenLoad('dashboard', start);
        return;
      }

      const endTrips = trackApiLatency('fetch_trip_details');
      const { data: tripsData, error: tripsErr } = await supabase
        .from('trips')
        .select('*')
        .in('id', tripIds)
        .order('start_date', { ascending: true });
      endTrips();
      if (tripsErr) throw tripsErr;

      const now = new Date();
      const enriched = await Promise.all(
        (tripsData ?? []).map(async (t) => {
          const { count } = await supabase
            .from('trip_members')
            .select('id', { count: 'exact', head: true })
            .eq('trip_id', t.id);
          return { ...t, memberCount: count ?? 0, member_count: count ?? 0 };
        })
      );

      setUpcoming(enriched.filter((t) => new Date(t.end_date) >= now));
      setPast(enriched.filter((t) => new Date(t.end_date) < now));
      trackScreenLoad('dashboard', start);
    } catch (err) {
      captureException(err as Error, { screen: 'dashboard', action: 'fetchTrips' });
      setError("Couldn't load your trips. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    track('screen_view_dashboard');
    fetchTrips();
  }, [fetchTrips]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTrips();
  }, [fetchTrips]);

  const handleCreateTrip = () => {
    fabScale.value = withSpring(0.9, {}, () => {
      fabScale.value = withSpring(1);
    });
    router.push('/(modal)/create-trip' as never);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  const upcomingTrip = upcoming[0] ?? null;
  const heroTrip = upcomingTrip
    ? {
        id: upcomingTrip.id,
        name: upcomingTrip.name,
        destination: upcomingTrip.destination ?? '',
        start_date: upcomingTrip.start_date,
        end_date: upcomingTrip.end_date,
        member_count: upcomingTrip.member_count ?? upcomingTrip.memberCount ?? 0,
        cover_emoji: undefined as string | undefined,
      }
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={past}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            {/* Title */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>My Trips</Text>
            </View>

            {error ? (
              <View style={{ margin: 16, padding: 14, backgroundColor: colors.error + '22', borderRadius: radii.md }}>
                <Text style={{ color: colors.error, fontSize: 14 }}>{error}</Text>
              </View>
            ) : null}

            {/* Hero Card */}
            {heroTrip ? (
              <Animated.View entering={FadeInDown.delay(0).duration(400)}>
                <TripHeroCard
                  trip={heroTrip}
                  onPress={() => router.push(`/(tabs)/trip/${heroTrip.id}/itinerary` as never)}
                />
              </Animated.View>
            ) : (
              <EmptyState
                icon={<Flag size={40} color={colors.textSecondary} />}
                title="No upcoming trips"
                description="Create a trip to get started"
                action={{ label: 'Create Trip', onPress: handleCreateTrip }}
              />
            )}

            {/* Upcoming list (excluding hero) */}
            {upcoming.slice(1).map((trip, i) => {
              const pastTripData = {
                id: trip.id,
                name: trip.name,
                destination: trip.destination ?? '',
                start_date: trip.start_date,
                end_date: trip.end_date,
                member_count: trip.member_count ?? trip.memberCount ?? 0,
                cover_emoji: undefined as string | undefined,
              };
              return (
                <Animated.View key={trip.id} entering={FadeInDown.delay(i * 80).duration(350)}>
                  <PastTripRow
                    trip={pastTripData}
                    onPress={() => router.push(`/(tabs)/trip/${trip.id}/itinerary` as never)}
                  />
                </Animated.View>
              );
            })}

            {past.length > 0 && (
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                Past Trips
              </Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const pastTripData = {
            id: item.id,
            name: item.name,
            destination: item.destination ?? '',
            start_date: item.start_date,
            end_date: item.end_date,
            member_count: item.member_count ?? item.memberCount ?? 0,
            cover_emoji: undefined as string | undefined,
          };
          return (
            <Animated.View entering={FadeInDown.delay(index * 80).duration(350)}>
              <PastTripRow
                trip={pastTripData}
                onPress={() => router.push(`/(tabs)/trip/${item.id}/itinerary` as never)}
              />
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          upcoming.length === 0 ? null : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* FAB */}
      <Animated.View
        style={[
          fabStyle,
          {
            position: 'absolute',
            bottom: 24 + (Platform.OS === 'ios' ? 0 : 0),
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          },
        ]}
      >
        <Pressable onPress={handleCreateTrip} style={{ width: 56, height: 56, justifyContent: 'center', alignItems: 'center' }}>
          <Plus size={24} color="#fff" />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
