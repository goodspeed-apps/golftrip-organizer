import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Clock, MapPin, Plus, Users, CheckCircle2, Circle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { TripTabBar } from '@/components/TripTabBar';
import type { Trip, TeeTime } from '@/types/app';

export default function ItineraryScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    const start = Date.now();
    const stop = trackApiLatency('fetch_itinerary');
    try {
      setError(null);
      const [tripRes, teeRes] = await Promise.all([
        supabase.from('trips').select('*').eq('id', id).single(),
        supabase.from('tee_times').select('*').eq('trip_id', id).order('tee_date').order('tee_time'),
      ]);
      if (tripRes.error) throw tripRes.error;
      if (teeRes.error) throw teeRes.error;
      setTrip(tripRes.data as Trip);
      setTeeTimes((teeRes.data ?? []) as TeeTime[]);
      stop();
      trackScreenLoad('itinerary', start);
    } catch (err) {
      captureException(err as Error, { screen: 'itinerary', action: 'fetchData' });
      setError("Couldn't load itinerary. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    track('screen_view_itinerary', { trip_id: id });
    fetchData();
  }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const s = styles(colors);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <LoadingSkeleton width="60%" height={28} borderRadius={8} style={{ margin: 16 }} />
        {[0, 1, 2].map((i) => (
          <LoadingSkeleton key={i} width="100%" height={90} borderRadius={16} style={{ marginHorizontal: 16, marginBottom: 12 }} />
        ))}
      </SafeAreaView>
    );
  }

  const grouped = teeTimes.reduce<Record<string, TeeTime[]>>((acc, t) => {
    const key = t.tee_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});
  const days = Object.keys(grouped).sort();

  return (
    <SafeAreaView style={s.container}>
      <TripTabBar tripId={id} active="itinerary" tripName={trip?.name ?? ''} />
      <FlatList
        data={days}
        keyExtractor={(d) => d}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          error ? (
            <View style={s.errorCard}><Text style={s.errorText}>{error}</Text></View>
          ) : (
            <EmptyState
              icon="calendar"
              title="No tee times yet"
              description="Add your first tee time to kick off the itinerary!"
              actionLabel="Add Tee Time"
              onAction={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(`/(modal)/add-tee-time?tripId=${id}`);
              }}
            />
          )
        }
        renderItem={({ item: day, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} style={s.daySection}>
            <Text style={s.dayLabel}>{formatDayLabel(day)}</Text>
            {grouped[day].map((tt, i) => (
              <Animated.View key={tt.id} entering={FadeInDown.delay(i * 40 + 60).duration(280)}>
                <TeeTimeCard
                  teeTime={tt}
                  colors={colors}
                  onPress={() => {
                    track('tap_tee_time', { tee_time_id: tt.id });
                    router.push(`/(modal)/tee-time-detail?id=${tt.id}&tripId=${id}`);
                  }}
                />
              </Animated.View>
            ))}
          </Animated.View>
        )}
      />
      <Pressable
        style={s.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(`/(modal)/add-tee-time?tripId=${id}`);
        }}
        accessibilityLabel="Add tee time"
        accessibilityHint="Opens the add tee time form"
      >
        <Plus color={colors.textOnPrimary} size={26} strokeWidth={2.5} />
      </Pressable>
    </SafeAreaView>
  );
}

function TeeTimeCard({ teeTime, colors, onPress }: { teeTime: TeeTime; colors: ReturnType<typeof useThemeColors>; onPress: () => void }) {
  const confirmed = !!teeTime.confirmation_number;
  return (
    <Pressable onPress={onPress} style={[cardStyles(colors).card, { borderLeftWidth: 4, borderLeftColor: confirmed ? colors.success : colors.warning }]} accessibilityLabel={`Tee time at ${teeTime.course_name}`} accessibilityHint="Tap to view details">
      <View style={cardStyles(colors).row}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles(colors).courseName}>{teeTime.course_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
            <Clock color={colors.textSecondary} size={13} />
            <Text style={cardStyles(colors).meta}>{teeTime.tee_time ?? '--:--'}</Text>
            <MapPin color={colors.textSecondary} size={13} />
            <Text style={cardStyles(colors).meta}>{teeTime.course_city ?? ''}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {confirmed ? <CheckCircle2 color={colors.success} size={20} /> : <Circle color={colors.warning} size={20} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users color={colors.textSecondary} size={13} />
            <Text style={cardStyles(colors).meta}>{teeTime.player_count ?? 0}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const cardStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: c.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  courseName: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: c.text },
  meta: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: c.textSecondary },
});

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    daySection: { paddingHorizontal: 16, paddingTop: 16 },
    dayLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    errorCard: { margin: 16, padding: 14, backgroundColor: colors.warningMuted, borderRadius: 12 },
    errorText: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.text },
    fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  });
