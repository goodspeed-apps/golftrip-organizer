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
  const colors = useThemeColors();
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
      <TripTabBar tripId={id} active="itinerary" />

      {days.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
          {days.map((day, i) => {
            const label = new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return (
              <Pressable
                key={day}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDay(i);
                  track('tap_day_tab', { day });
                }}
                accessibilityLabel={`Day ${i + 1}: ${label}`}
                style={[styles.dayTab, selectedDay === i && styles.dayTabActive]}
              >
                <Text style={[styles.dayTabText, selectedDay === i && styles.dayTabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={filteredTeeTimes}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <TeeTimeCard teeTime={item} colors={colors} onPress={() => {
              track('tap_tee_time_card', { tee_time_id: item.id });
              router.push(`/(modal)/tee-time-detail?id=${item.id}` as never);
            }} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Flag size={36} color={colors.primary} />}
            title="No tee times yet for this day"
            description="Add a tee time to get the round on the books."
            action={{
              label: 'Add Tee Time',
              onPress: () => {
                track('tap_add_tee_time_empty', {});
                router.push(`/(modal)/add-tee-time?trip_id=${id}` as never);
              },
            }}
          />
        }
      />

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          track('tap_add_tee_time_fab', {});
          router.push(`/(modal)/add-tee-time?trip_id=${id}` as never);
        }}
        accessibilityLabel="Add tee time"
        accessibilityHint="Opens the add tee time form"
        style={({ pressed }) => [styles.fab, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Plus size={24} color={colors.textOnPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

function TeeTimeCard({ teeTime, colors, onPress }: { teeTime: TeeTime; colors: ReturnType<typeof useThemeColors>; onPress: () => void }) {
  const styles = makeStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Tee time at ${teeTime.course_name}`}
      accessibilityHint="Tap to view details"
      style={({ pressed }) => [styles.teeCard, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.teeLeft}>
        <View style={styles.teeIconWrap}><Flag size={18} color={colors.primary} /></View>
        <View style={styles.teeInfo}>
          <Text style={styles.teeCourse} numberOfLines={1}>{teeTime.course_name}</Text>
          {teeTime.course_city && <Text style={styles.teeCity}>{teeTime.course_city}</Text>}
          <View style={styles.teeMeta}>
            <Clock size={12} color={colors.textSecondary} />
            <Text style={styles.teeMetaText}>{teeTime.tee_time} · {teeTime.player_count} players</Text>
          </View>
          {teeTime.confirmation_number && (
            <Text style={styles.confirmation}>Conf: {teeTime.confirmation_number}</Text>
          )}
        </View>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
    tripName: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: colors.text },
    dayTabs: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
    dayTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.xl, backgroundColor: colors.surfaceSecondary, minHeight: 36, justifyContent: 'center' },
    dayTabActive: { backgroundColor: colors.primary },
    dayTabText: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary },
    dayTabTextActive: { color: colors.textOnPrimary },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: 100, paddingTop: spacing.sm },
    teeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, marginBottom: spacing.sm, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
    teeLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    teeIconWrap: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    teeInfo: { flex: 1, gap: 2 },
    teeCourse: { fontFamily: 'Manrope_700Bold', fontSize: 15, color: colors.text },
    teeCity: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: colors.textSecondary },
    teeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    teeMetaText: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: colors.textSecondary },
    confirmation: { fontFamily: 'Manrope_400Regular', fontSize: 11, color: colors.textMuted, marginTop: 2 },
    errorCard: { backgroundColor: colors.warningMuted, margin: spacing.md, borderRadius: radii.md, padding: spacing.md },
    errorText: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: colors.warning },
    fab: { position: 'absolute', bottom: spacing.xl, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  });
