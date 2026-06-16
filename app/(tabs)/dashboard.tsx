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
    fabScale.value = withSpring(0.9, {}, () => { fabScale.value = withSpring(1); });
    router.push('/(modal)/create-trip' as never);
  };

  const c = colors as unknown as Record<string, string>;

  const ListEmpty = () => (
    <EmptyState
      title="No trips yet"
      description="Create your first golf trip and invite your crew!"
      icon="flag"
    />
  );

  const renderUpcoming = ({ item }: { item: Trip }) => (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <TripHeroCard
        trip={{
          id: item.id,
          name: item.name,
          destination: '',
          start_date: item.start_date,
          end_date: item.end_date,
          member_count: item.memberCount ?? 0,
          cover_emoji: undefined,
        }}
        onPress={() => router.push(`/(tabs)/trip/${item.id}/itinerary` as never)}
      />
    </Animated.View>
  );

  const renderPast = ({ item }: { item: Trip }) => (
    <Animated.View entering={FadeInDown.delay(50).duration(300)}>
      <PastTripRow
        trip={{
          id: item.id,
          name: item.name,
          destination: '',
          start_date: item.start_date,
          end_date: item.end_date,
          member_count: item.memberCount ?? 0,
          cover_emoji: undefined,
        }}
        onPress={() => router.push(`/(tabs)/trip/${item.id}/itinerary` as never)}
      />
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        data={upcoming}
        keyExtractor={(item) => item.id}
        renderItem={renderUpcoming}
        ListEmptyComponent={ListEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: c.text }}>My Trips</Text>
          </View>
        }
        ListFooterComponent={
          past.length > 0 ? (
            <View>
              <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Past Trips</Text>
              </View>
              {past.map((item) => renderPast({ item }))}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 100,
            right: spacing.lg,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: c.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          },
          fabStyle,
        ]}
      >
        <Pressable onPress={handleCreateTrip} style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
          <Plus size={28} color="#fff" />
        </Pressable>
      </Animated.View>

      {error && (
        <View style={{ position: 'absolute', bottom: 170, left: spacing.md, right: spacing.md }}>
          <View style={{ backgroundColor: c.error, borderRadius: radii.md, padding: spacing.md }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{error}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
