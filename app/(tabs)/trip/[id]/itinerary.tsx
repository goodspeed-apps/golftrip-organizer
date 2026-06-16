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
  destination: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  invite_code: string;
  status: string;
  member_count: number;
  member_limit: number;
  organizer_id: string;
  cover_emoji?: string;
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
      setTrip(tripRes.data as Trip);
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
    showToast('Invite code copied! Share it with your crew 🏌️');
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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState
          title="Couldn't load itinerary"
          subtitle={error}
          icon={Calendar}
        />
      </SafeAreaView>
    );
  }

  const groupedDays = groupByDay(teeTimes);
  const sortedDates = Object.keys(groupedDays).sort();

  const isOrganizer = trip?.organizer_id === user?.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={sortedDates}
        keyExtractor={(date) => date}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          trip ? (
            <TripHeaderBanner
              trip={{
                name: trip.name,
                destination: trip.destination,
                start_date: trip.start_date,
                end_date: trip.end_date,
                member_count: trip.member_count,
                cover_emoji: trip.cover_emoji,
              }}
              onCopyInvite={handleCopyInvite}
              colors={colors}
            />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title="No tee times yet"
            subtitle="Add your first tee time to get the crew organized"
            icon={Calendar}
            action={isOrganizer ? { label: 'Add Tee Time', onPress: handleAddTeeTime } : undefined}
          />
        }
        renderItem={({ item: date }) => (
          <TripDaySection
            date={date}
            teeTimes={groupedDays[date]}
            tripId={id ?? ''}
          />
        )}
      />
      {isOrganizer && (
        <Pressable
          onPress={handleAddTeeTime}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Plus size={24} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}
