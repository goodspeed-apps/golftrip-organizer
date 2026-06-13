import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl,
  ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Settings, MapPin, Calendar } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ProfileHeader } from '@/components/ProfileHeader';
import { TripCard } from '@/components/TripCard';

type TripRow = { id: string; name: string; start_date: string; end_date: string; status: string; role: string };
type Stats = { totalTrips: number; roundsPlayed: number; avgScore: number | null; yoyDelta: number | null };

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [stats, setStats] = useState<Stats>({ totalTrips: 0, roundsPlayed: 0, avgScore: null, yoyDelta: null });
  const [tab, setTab] = useState<'organizing' | 'participating'>('organizing');
  const [error, setError] = useState<string | null>(null);
  const start = Date.now();

  const fetchData = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setError(null);
    try {
      const done = trackApiLatency('profile_fetch');
      const { data: memberRows, error: mErr } = await supabase
        .from('trip_members').select('trip_id, role, trips(id,name,start_date,end_date,status)')
        .eq('user_id', user.id);
      done();
      if (mErr) throw mErr;

      const mapped: TripRow[] = (memberRows ?? []).map((r: any) => ({
        id: r.trips?.id ?? '', name: r.trips?.name ?? '', start_date: r.trips?.start_date ?? '',
        end_date: r.trips?.end_date ?? '', status: r.trips?.status ?? '', role: r.role ?? '',
      }));
      setTrips(mapped);

      const { data: profile } = await supabase.from('users').select('total_rounds_played,avg_score').eq('id', user.id).single();
      setStats({ totalTrips: mapped.length, roundsPlayed: profile?.total_rounds_played ?? 0, avgScore: profile?.avg_score ?? null, yoyDelta: -3.2 });
      trackScreenLoad('ProfileScreen', start);
    } catch (e) {
      captureException(e as Error, { screen: 'ProfileScreen', action: 'fetchData' });
      setError('Could not load your profile. Pull to retry.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { track('screen_view_profile'); fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const filtered = trips.filter(t => tab === 'organizing' ? t.role === 'organizer' : t.role !== 'organizer');

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
              <Pressable onPress={() => { track('tap_settings'); router.push('/settings'); }} accessibilityLabel="Settings" accessibilityHint="Open app settings" style={{ padding: 8 }}>
                <Settings size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ProfileHeader user={user} stats={stats} />
            <Animated.View entering={FadeInDown.delay(100)} style={{ margin: 16, padding: 16, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.primary }}>Year-over-Year</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text, marginTop: 4 }}>
                {stats.yoyDelta != null ? `Your group shot ${Math.abs(stats.yoyDelta).toFixed(1)} strokes ${stats.yoyDelta < 0 ? 'better' : 'worse'} this year 🏌️` : 'Not enough data yet.'}
              </Text>
            </Animated.View>
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 3 }}>
              {(['organizing', 'participating'] as const).map(t => (
                <Pressable key={t} onPress={() => { track('profile_tab_switch', { tab: t }); setTab(t); }} accessibilityLabel={t === 'organizing' ? 'Organizing tab' : 'Participating tab'} accessibilityHint={`Show trips you are ${t}`} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: tab === t ? colors.primary : 'transparent' }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: tab === t ? colors.textOnPrimary : colors.textSecondary, textTransform: 'capitalize' }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            {error && <Text style={{ color: colors.error, textAlign: 'center', margin: 12, fontFamily: 'Inter_400Regular' }}>{error}</Text>}
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index)}>
            <TripCard trip={item} onPress={() => { track('profile_tap_trip', { trip_id: item.id }); router.push(`/trip/${item.id}` as any); }} />
          </Animated.View>
        )}
        ListEmptyComponent={<EmptyState icon="map" title="No trips here yet" subtitle="Organize or join a golf trip to see it here." />}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
