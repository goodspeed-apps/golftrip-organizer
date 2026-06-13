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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.colors.background }}>
        <LoadingSkeleton variant="card" count={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.colors.background }}>
      <FlatList
        data={upcomingTrips}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.colors.text }}>
              {greeting()}, {user?.user_metadata?.display_name ?? 'Golfer'} 👋
            </Text>
            <Text style={{ color: colors.colors.textSecondary, marginTop: 4 }}>
              {upcomingTrips.length > 0
                ? `You have ${upcomingTrips.length} upcoming trip${upcomingTrips.length > 1 ? 's' : ''}`
                : 'No upcoming trips — time to plan one!'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Animated.View entering={FadeInDown}>
            <TripHeroCard trip={item} onPress={() => router.push(`/(tabs)/trip/${item.id}/itinerary`)} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No upcoming trips"
            description="Create a trip to get started with your crew."
            actionLabel="Create Trip"
            onAction={handleCreateTrip}
          />
        }
        ListFooterComponent={
          pastTrips.length > 0 ? (
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.colors.text, marginBottom: 12 }}>Past Trips</Text>
              {pastTrips.map((trip) => (
                <PastTripRow
                  key={trip.id}
                  trip={trip}
                  onPress={() => router.push(`/(tabs)/trip/${trip.id}/itinerary`)}
                  onLongPress={() => handleLongPressPast(trip)}
                />
              ))}
            </View>
          ) : null
        }
      />

      <Pressable
        onPress={handleCreateTrip}
        style={{
          position: 'absolute', bottom: 28, right: 20,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.colors.primary,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Plus size={26} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});
