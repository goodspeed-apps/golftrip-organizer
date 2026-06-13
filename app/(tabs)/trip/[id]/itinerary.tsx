import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Clock, MapPin, Plus, Users } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { TripTabBar } from '@/components/TripTabBar';
import { fetchTeeTimes } from '@/services/tripService';
import { TeeTime } from '@/types/app';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { Spacing, BorderRadius } from '@/lib/theme';

export default function ItineraryScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { track } = useAnalytics();
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const startTime = React.useRef(Date.now());

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setError(null);
    try {
      const data = await fetchTeeTimes(id);
      setTeeTimes(data);
      trackScreenLoad('itinerary', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'itinerary', action: 'load' });
      setError("Couldn't load tee times. Pull down to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    track('screen_view_itinerary', { trip_id: id });
    load();
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <TripTabBar tripId={id ?? ''} active="itinerary" />
        <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
          {[1, 2, 3].map((i) => <LoadingSkeleton key={i} width="100%" height={88} style={{ borderRadius: BorderRadius.xl }} />)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <TripTabBar tripId={id ?? ''} active="itinerary" />
      <FlatList
        data={teeTimes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              icon="calendar"
              title="No tee times yet"
              description="Add your first tee time and the crew will know exactly when to show up!"
              actionLabel="Add Tee Time"
              onAction={() => router.push(`/(modal)/add-tee-time?tripId=${id}` as never)}
            />
          ) : (
            <View style={[styles.errBox, { backgroundColor: colors.warningMuted, borderRadius: BorderRadius.lg }]}>
              <Text style={[{ color: colors.warning, fontFamily: 'Manrope_400Regular' }]}>{error}</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <Pressable
              style={[styles.card, { backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                track('tee_time_tap', { tee_time_id: item.id });
              }}
              accessibilityLabel={`Tee time at ${item.course_name}`}
              accessibilityHint="Tap to view tee time details"
            >
              <View style={[styles.dateChip, { backgroundColor: colors.primaryMuted }]}>
                <Text style={[styles.dateChipText, { color: colors.primary }]}>{fmtDate(item.tee_date)}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.courseName, { color: colors.text }]} numberOfLines={1}>{item.course_name}</Text>
                <View style={styles.metaRow}>
                  <Clock size={13} color={colors.textSecondary} strokeWidth={1.5} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>{fmtTime(item.tee_time)}</Text>
                  <Users size={13} color={colors.textSecondary} strokeWidth={1.5} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.player_count} players</Text>
                  {item.course_city && <><MapPin size={13} color={colors.textSecondary} strokeWidth={1.5} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.course_city}</Text></>}
                </View>
                {item.confirmation_number && (
                  <Text style={[styles.confirm, { color: colors.textMuted }]}>Conf: {item.confirmation_number}</Text>
                )}
              </View>
            </Pressable>
          </Animated.View>
        )}
      />
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          track('add_tee_time_fab');
          router.push(`/(modal)/add-tee-time?tripId=${id}` as never);
        }}
        accessibilityLabel="Add tee time"
        accessibilityHint="Opens form to add a new tee time"
      >
        <Plus size={26} color={colors.textOnPrimary} strokeWidth={2} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: { borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
  dateChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  dateChipText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  cardBody: { padding: Spacing.md },
  courseName: { fontFamily: 'Outfit_700Bold', fontSize: 17, marginBottom: Spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  metaText: { fontFamily: 'Manrope_400Regular', fontSize: 13 },
  confirm: { fontFamily: 'Manrope_400Regular', fontSize: 12, marginTop: Spacing.xs },
  errBox: { padding: Spacing.md },
  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.lg, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
