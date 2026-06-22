import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, ScrollView, RefreshControl,
  StyleSheet, Pressable, ActionSheetIOS, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { PlusCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Spacing, BorderRadius } from '@/lib/theme';
import { trackScreenLoad } from '@/lib/performance';
import { captureException } from '@/lib/sentry';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast, useToast } from '@/components/ui/Toast';
import { TripHeroCard } from '@/components/TripHeroCard';
import { PastTripRow } from '@/components/PastTripRow';
import { fetchMyTrips, deleteTrip } from '@/services/tripService';
import type { TripWithMemberCount } from '@/types/golf';

export default function DashboardScreen() {
  const { colors } = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const startTime = useRef(Date.now());

  const [upcoming, setUpcoming] = useState<TripWithMemberCount[]>([]);
  const [past, setPast] = useState<TripWithMemberCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const result = await fetchMyTrips(user.id);
      if (result.error) {
        setError(result.error);
      } else {
        setUpcoming(result.upcoming);
        setPast(result.past);
        trackScreenLoad('dashboard', startTime.current);
      }
    } catch (err) {
      captureException(err as Error, { screen: 'dashboard', action: 'loadTrips' });
      setError("Couldn't load your trips. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    track('screen_view_dashboard');
    loadTrips();
  }, [loadTrips]);

  const onRefresh = () => { setRefreshing(true); loadTrips(); };

  const handleLongPress = (trip: TripWithMemberCount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Delete Trip'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await handleDelete(trip);
        },
      );
    } else {
      Alert.alert('Trip Options', trip.name, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(trip) },
      ]);
    }
  };

  const handleDelete = async (trip: TripWithMemberCount) => {
    const { error: delErr } = await deleteTrip(trip.id);
    if (delErr) showToast({ message: delErr, type: 'error' });
    else {
      showToast({ message: `${trip.name} deleted`, type: 'success' });
      loadTrips();
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Golfer';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingHorizontal: Spacing.lg }]}>
          <LoadingSkeleton width={160} height={24} />
        </View>
        <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.md }}>
          {[0, 1, 2].map((i) => <LoadingSkeleton key={i} width="100%" height={180} borderRadius={BorderRadius.xl} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: Spacing.xl * 2 }}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={[styles.header, { paddingHorizontal: Spacing.lg }]}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting()},</Text>
          <Text style={[styles.name, { color: colors.text }]}>{displayName} 👋</Text>
        </Animated.View>

        {error ? (
          <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.errorCard, { backgroundColor: colors.surface, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            <Pressable onPress={loadTrips} accessibilityLabel="Retry loading trips" style={styles.retryBtn}>
              <Text style={[styles.retryText, { color: colors.primary }]}>Try Again</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: Spacing.lg }]}>
            {upcoming.length > 0 ? "Coming Up 🏌️" : "Your Trips"}
          </Text>
        </Animated.View>

        {upcoming.length === 0 && !loading ? (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ paddingHorizontal: Spacing.lg }}>
            <EmptyState
              title="No trips planned yet"
              description="Tap the button below to kick off your next golf adventure!"
              action={{ label: "Create a Trip", onPress: () => router.push('/(modal)/create-trip') }}
            />
          </Animated.View>
        ) : (
          <FlatList
            horizontal
            data={upcoming}
            keyExtractor={(t) => t.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm }}
            renderItem={({ item, index }) => (
              <TripHeroCard
                trip={item}
                index={index}
                onPress={() => { track('trip_opened', { trip_id: item.id }); router.push(`/(tabs)/trip/${item.id}/itinerary` as never); }}
                onLongPress={() => handleLongPress(item)}
              />
            )}
          />
        )}

        {past.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Past Trips ⛳</Text>
            {past.map((trip, i) => (
              <Animated.View key={trip.id} entering={FadeInDown.delay(150 + i * 50).duration(350)}>
                <PastTripRow
                  trip={trip}
                  onPress={() => { track('past_trip_opened', { trip_id: trip.id }); router.push(`/(tabs)/trip/${trip.id}/itinerary` as never); }}
                  onLongPress={() => handleLongPress(trip)}
                />
              </Animated.View>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => { track('create_trip_tapped'); router.push('/(modal)/create-trip' as never); }}
        accessibilityLabel="Create a new trip"
        accessibilityHint="Opens the trip creation form"
        testID="dashboard-create-trip"
        style={[styles.fab, { backgroundColor: colors.primary, borderRadius: 28, shadowColor: colors.text }]}
      >
        <PlusCircle size={28} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  greeting: { fontSize: 14, fontWeight: '500' },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.md, marginTop: Spacing.sm },
  errorCard: { padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { fontSize: 14 },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start' },
  retryText: { fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
