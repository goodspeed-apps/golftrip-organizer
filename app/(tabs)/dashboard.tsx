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
}

export default function DashboardScreen() {
  const colors = useThemeColors();
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
          return { ...t, memberCount: count ?? 0 };
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
    fabScale.value = withSpring(0.88, { damping: 10 }, () => {
      fabScale.value = withSpring(1);
    });
    track('tap_create_trip_fab');
    router.push('/(modal)/create-trip');
  };

  const handleLongPressPast = (trip: Trip) => {
    track('long_press_past_trip', { trip_id: trip.id });
    Alert.alert(trip.name, 'What would you like to do?', [
      { text: 'View Recap', onPress: () => router.push(`/(tabs)/trip/${trip.id}/itinerary` as never) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const displayName = user?.email?.split('@')[0] ?? 'Golfer';

  const ListHeader = () => (
    <View>
      <Animated.View entering={FadeInDown.delay(0).duration(400)}>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 26, color: colors.text }}>
            {"Hey, " + displayName + " 👋"}
          </Text>
          <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, marginTop: 2 }}>
            {"Here's what's on your calendar."}
          </Text>
        </View>
      </Animated.View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </View>
      ) : error ? (
        <View style={{ margin: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.xl }}>
          <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.error, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={fetchTrips} style={{ marginTop: spacing.sm, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Manrope_600SemiBold', color: colors.primary }}>Retry</Text>
          </Pressable>
        </View>
      ) : upcoming.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <EmptyState
            icon={<Flag size={40} color={colors.primary} />}
            title="No trips yet!"
            description={"Create your first trip and invite the crew. The fairways are waiting."}
            action={{ label: 'Plan a Trip', onPress: handleCreateTrip }}
          />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.md, marginBottom: spacing.sm, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Upcoming Trips
          </Text>
          {upcoming.map((trip, i) => (
            <Animated.View key={trip.id} entering={FadeInDown.delay(50 * i).duration(350)}>
              <TripHeroCard
                trip={trip}
                onPress={() => {
                  track('tap_trip_card', { trip_id: trip.id });
                  router.push(`/(tabs)/trip/${trip.id}/itinerary` as never);
                }}
              />
            </Animated.View>
          ))}
        </Animated.View>
      )}

      {!loading && !error && past.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Past Trips
          </Text>
        </Animated.View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <FlatList
        data={loading || error ? [] : past}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index).duration(350)}>
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
        ListFooterComponent={<View style={{ height: 100 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />

      <Animated.View
        style={[
          fabStyle,
          {
            position: 'absolute',
            bottom: spacing.xl,
            right: spacing.lg,
          },
        ]}
      >
        <Pressable
          onPress={handleCreateTrip}
          accessibilityLabel="Create a new trip"
          accessibilityHint="Opens the trip creation form"
          style={{
            backgroundColor: colors.primary,
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Plus size={24} color={colors.textOnPrimary} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
