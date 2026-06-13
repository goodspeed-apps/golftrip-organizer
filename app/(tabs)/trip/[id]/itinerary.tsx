import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Clock, Plus, Flag, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { TripTabBar } from '@/components/TripTabBar';
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

interface TripInfo {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export default function ItineraryScreen() {
  const { colors } = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [trip, setTrip] = useState<TripInfo | null>(null);
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  const fetchData = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    const start = Date.now();
    try {
      setError(null);
      const endLatency = trackApiLatency('fetch_itinerary');
      const [tripRes, teeRes] = await Promise.all([
        supabase.from('trips').select('id,name,start_date,end_date').eq('id', id).single(),
        supabase.from('tee_times').select('*').eq('trip_id', id).order('tee_date').order('tee_time'),
      ]);
      if (tripRes.error) throw tripRes.error;
      if (teeRes.error) throw teeRes.error;
      endLatency();
      setTrip(tripRes.data);
      setTeeTimes(teeRes.data ?? []);
      trackScreenLoad('Itinerary', start);
    } catch (err) {
      captureException(err as Error, { screen: 'Itinerary', action: 'fetchData' });
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

  const getDays = (): string[] => {
    if (!trip) return [];
    const days: string[] = [];
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  const days = getDays();
  const selectedDate = days[selectedDay];
  const filteredTeeTimes = teeTimes.filter((t) => t.tee_date === selectedDate);
  const styles = makeStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSkeleton variant="card" count={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.tripName} numberOfLines={1}>{trip?.name ?? 'Trip'}</Text>
      </View>
      <TripTabBar tripId={id ?? ''} active="itinerary" />

      {days.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          {days.map((day, idx) => (
            <Pressable
              key={day}
              onPress={() => { setSelectedDay(idx); Haptics.selectionAsync(); }}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                backgroundColor: idx === selectedDay ? colors.primary : colors.card,
              }}
            >
              <Text style={{ color: idx === selectedDay ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filteredTeeTimes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={
          <EmptyState
            title={error ?? 'No tee times'}
            description={error ? 'Pull down to retry.' : 'No tee times scheduled for this day.'}
          />
        }
        renderItem={({ item }) => (
          <Animated.View entering={FadeInDown}>
            <Pressable
              style={styles.card}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/(modal)/tee-time-detail?teeTimeId=${item.id}`);
              }}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                  <Flag size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseName}>{item.course_name}</Text>
                  {item.course_city && (
                    <Text style={styles.courseCity}>{item.course_city}</Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Clock size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.teeTime}>{item.tee_time}</Text>
                    <Text style={[styles.teeTime, { marginLeft: 12 }]}>👥 {item.player_count}</Text>
                    {item.confirmation_number && (
                      <Text style={[styles.teeTime, { marginLeft: 12 }]}>#{item.confirmation_number}</Text>
                    )}
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </View>
            </Pressable>
          </Animated.View>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push(`/(modal)/add-tee-time?tripId=${id}`)}
      >
        <Plus size={26} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useThemeColors>['colors'];

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    tripName: { fontSize: 22, fontWeight: '800', color: colors.text },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    cardIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.primary + '22',
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    courseName: { fontSize: 15, fontWeight: '700', color: colors.text },
    courseCity: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    teeTime: { fontSize: 13, color: colors.textSecondary },
    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
    },
  });
}
