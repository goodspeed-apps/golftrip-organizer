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
  const colorsContext = useThemeColors();
  const colors = colorsContext.colors ?? colorsContext;
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
    fabScale.value = withSpring(0.9, {}, () => { fabScale.value = withSpring(1); });
    router.push('/(modal)/create-trip' as never);
  };

  const handleTripPress = (trip: Trip) => {
    track('tap_trip_card', { trip_id: trip.id });
    router.push(`/(tabs)/trip/${trip.id}/itinerary` as never);
  };

  const themeColors = colors as Record<string, string>;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <LoadingSkeleton variant="card" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <FlatList
        data={upcoming}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
        }
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: themeColors.text }}>My Trips</Text>
            </View>
            {error && (
              <Text style={{ color: themeColors.error, marginBottom: spacing.sm }}>{error}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Animated.View entering={FadeInDown.duration(350)}>
            <TripHeroCard
              trip={{
                id: item.id,
                name: item.name,
                destination: item.destination ?? '',
                start_date: item.start_date,
                end_date: item.end_date,
                member_count: item.member_count ?? item.memberCount ?? 0,
                cover_emoji: undefined,
              }}
              onPress={() => handleTripPress(item)}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No Upcoming Trips"
            subtitle="Create your first trip to get started!"
          />
        }
        ListFooterComponent={
          past.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: themeColors.text, marginBottom: spacing.sm }}>Past Trips</Text>
              {past.map((item) => (
                <PastTripRow
                  key={item.id}
                  trip={{
                    id: item.id,
                    name: item.name,
                    destination: item.destination ?? '',
                    start_date: item.start_date,
                    end_date: item.end_date,
                    member_count: item.member_count ?? item.memberCount ?? 0,
                    cover_emoji: undefined,
                  }}
                  onPress={() => handleTripPress(item)}
                />
              ))}
            </View>
          ) : null
        }
      />

      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 24 + (Platform.OS === 'ios' ? 0 : 0),
            right: 24,
          },
          fabStyle,
        ]}
      >
        <Pressable
          onPress={handleCreateTrip}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: themeColors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
          accessibilityLabel="Create new trip"
        >
          <Plus size={28} color="#fff" />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
