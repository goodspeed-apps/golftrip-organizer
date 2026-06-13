import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Plus, MapPin, Users, Calendar } from 'lucide-react-native';
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
import type { Trip } from '@/types/app';

export default function DashboardScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [upcoming, setUpcoming] = useState<Trip[]>([]);
  const [past, setPast] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fabScale = useSharedValue(1);

  const fetchTrips = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const start = Date.now();
    try {
      setError(null);
      const stop = trackApiLatency('fetch_trips');
      const { data: memberRows, error: memberErr } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', user.id);
      if (memberErr) throw memberErr;
      const tripIds = (memberRows ?? []).map((r) => r.trip_id);
      if (tripIds.length === 0) {
        setUpcoming([]);
        setPast([]);
        stop();
        trackScreenLoad('dashboard', start);
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      const { data: tripData, error: tripErr } = await supabase
        .from('trips')
        .select('*')
        .in('id', tripIds)
        .order('start_date', { ascending: true });
      if (tripErr) throw tripErr;
      stop();
      const all = (tripData ?? []) as Trip[];
      setUpcoming(all.filter((t) => (t.end_date ?? '') >= today));
      setPast(all.filter((t) => (t.end_date ?? '') < today));
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const handleFabPress = () => {
    fabScale.value = withSpring(0.9, {}, () => {
      fabScale.value = withSpring(1);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    track('tap_create_trip_fab');
    router.push('/(modal)/create-trip');
  };

  const firstName = user?.user_metadata?.display_name?.split(' ')[0] ?? 'there';
  const s = styles(colors);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <LoadingSkeleton width={180} height={28} borderRadius={8} />
        </View>
        <LoadingSkeleton width="100%" height={220} borderRadius={20} style={{ marginHorizontal: 16 }} />
        <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
          {[0, 1, 2].map((i) => (
            <LoadingSkeleton key={i} width="100%" height={64} borderRadius={12} style={{ marginBottom: 8 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={past}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.delay(0).duration(400)} style={s.header}>
              <Text style={s.greeting}>Hey {firstName} 👋</Text>
              <Text style={s.subGreeting}>Ready to hit the fairway?</Text>
            </Animated.View>
            {error && (
              <Animated.View entering={FadeInDown.delay(50)} style={s.errorCard}>
                <Text style={s.errorText}>{error}</Text>
              </Animated.View>
            )}
            {upcoming.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                <Text style={s.sectionLabel}>Upcoming Trips</Text>
                <FlatList
                  data={upcoming}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={s.heroRow}
                  renderItem={({ item, index }) => (
                    <Animated.View entering={FadeInDown.delay(index * 50).duration(350)}>
                      <TripHeroCard
                        trip={item}
                        onPress={() => {
                          track('tap_trip_card', { trip_id: item.id });
                          router.push(`/(tabs)/trip/${item.id}/itinerary`);
                        }}
                      />
                    </Animated.View>
                  )}
                />
              </Animated.View>
            )}
            {upcoming.length === 0 && !error && (
              <Animated.View entering={FadeInDown.delay(100)}>
                <EmptyState
                  icon="map"
                  title="No upcoming trips yet"
                  description="Create your first golf trip and get the crew together!"
                  actionLabel="Create a Trip"
                  onAction={handleFabPress}
                />
              </Animated.View>
            )}
            {past.length > 0 && <Text style={[s.sectionLabel, { marginTop: 8 }]}>Past Trips</Text>}
          </>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <PastTripRow
              trip={item}
              onPress={() => router.push(`/(tabs)/trip/${item.id}/itinerary`)}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                track('long_press_past_trip', { trip_id: item.id });
                Alert.alert(item.name, 'What would you like to do?', [
                  { text: 'View Recap', onPress: () => router.push(`/(tabs)/trip/${item.id}/itinerary`) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          past.length === 0 && upcoming.length > 0 ? null : undefined
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <Animated.View style={[s.fab, fabAnimStyle]}>
        <Pressable
          onPress={handleFabPress}
          style={s.fabInner}
          accessibilityLabel="Create a new trip"
          accessibilityHint="Opens the trip creation form"
        >
          <Plus color={colors.textOnPrimary} size={28} strokeWidth={2.5} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    greeting: { fontSize: 26, fontFamily: 'Outfit_700Bold', color: colors.text },
    subGreeting: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, marginTop: 2 },
    sectionLabel: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: colors.text, paddingHorizontal: 16, marginBottom: 8 },
    heroRow: { paddingHorizontal: 16, gap: 12 },
    errorCard: { marginHorizontal: 16, marginBottom: 12, padding: 12, backgroundColor: colors.warningMuted, borderRadius: 12 },
    errorText: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.text },
    fab: { position: 'absolute', bottom: 28, right: 20 },
    fabInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  });
