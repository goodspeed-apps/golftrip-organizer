import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Calendar, Plus } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';
import { TripDaySection } from '@/components/trips/TripDaySection';
import { TripHeaderBanner } from '@/components/trips/TripHeaderBanner';
import { Spacing, BorderRadius } from '@/lib/theme';

const spacing = Spacing;
const radii = BorderRadius;

interface TeeTime {
  id: string;
  course_name: string;
  course_city: string | null;
  tee_date: string;
  tee_time: string;
  player_count: number;
  confirmation_number: string | null;
  notes: string | null;
}

interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  invite_code: string;
  status: string;
  member_limit: number;
  organizer_id: string;
}

export default function ItineraryScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { showToast } = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    const start = Date.now();
    try {
      setError(null);
      const endApi = trackApiLatency('fetch_itinerary');
      const [tripRes, ttRes] = await Promise.all([
        supabase.from('trips').select('*').eq('id', id).single(),
        supabase.from('tee_times').select('*').eq('trip_id', id).order('tee_date').order('tee_time'),
      ]);
      endApi();
      if (tripRes.error) throw tripRes.error;
      if (ttRes.error) throw ttRes.error;
      setTrip(tripRes.data);
      setTeeTimes(ttRes.data ?? []);
      trackScreenLoad('itinerary', start);
    } catch (err) {
      captureException(err as Error, { screen: 'itinerary', action: 'fetchData' });
      setError("Couldn't load the itinerary. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    track('screen_view_itinerary', { trip_id: id });
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const handleCopyInvite = async () => {
    if (!trip) return;
    await Clipboard.setStringAsync(trip.invite_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('copy_invite_code', { trip_id: id });
    showToast({ message: 'Invite code copied! Share it with your crew 🏌️', type: 'success' });
  };

  const handleAddTeeTime = () => {
    track('tap_add_tee_time', { trip_id: id });
    router.push(`/(modal)/add-tee-time?tripId=${id}` as never);
  };

  const groupByDay = (times: TeeTime[]): Record<string, TeeTime[]> => {
    return times.reduce<Record<string, TeeTime[]>>((acc, tt) => {
      (acc[tt.tee_date] = acc[tt.tee_date] ?? []).push(tt);
      return acc;
    }, {});
  };

  const days = Object.entries(groupByDay(teeTimes)).sort(([a], [b]) => a.localeCompare(b));

  const ListHeader = () => (
    <View>
      {trip && (
        <TripHeaderBanner
          trip={trip}
          onCopyInvite={handleCopyInvite}
          onAddTeeTime={handleAddTeeTime}
        />
      )}
      {loading && (
        <View style={{ padding: spacing.md }}>
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </View>
      )}
      {error && !loading && (
        <View style={{ margin: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.xl }}>
          <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.error, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={fetchData} style={{ marginTop: spacing.sm, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Manrope_600SemiBold', color: colors.primary }}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  if (!loading && !error && teeTimes.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ListHeader />
        <EmptyState
          icon={<Calendar size={40} color={colors.primary} />}
          title="No tee times yet"
          description={"Add your first tee time to kick things off. The course is calling!"}
          action={{ label: 'Add Tee Time', onPress: handleAddTeeTime }}
        />
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <FlatList
        data={days}
        keyExtractor={([date]) => date}
        ListHeaderComponent={ListHeader}
        renderItem={({ item: [date, times], index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index).duration(350)}>
            <TripDaySection date={date} teeTimes={times} tripId={id ?? ''} />
          </Animated.View>
        )}
        ListFooterComponent={<View style={{ height: 80 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      />

      <Pressable
        onPress={handleAddTeeTime}
        accessibilityLabel="Add a tee time"
        accessibilityHint="Opens the add tee time form"
        style={{
          position: 'absolute',
          bottom: spacing.xl,
          right: spacing.lg,
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
    </SafeAreaView>
  );
}
