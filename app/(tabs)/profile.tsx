import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
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

type TripRow = { id: string; name: string; start_date: string; end_date: string; status: string; role: string };
type Stats = { totalTrips: number; roundsPlayed: number; avgScore: number | null; yoyDelta: number | null };

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [stats, setStats] = useState<Stats>({ totalTrips: 0, roundsPlayed: 0, avgScore: null, yoyDelta: null });
  const [tab, setTab] = useState<'organizing' | 'participating'>('organizing');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const start = Date.now();
    try {
      const end = trackApiLatency('profile_fetch', start);
      const [profileRes, memberRes] = await Promise.all([
        supabase.from('users').select('total_rounds_played, avg_score, trip_streak').eq('id', user.id).single(),
        supabase.from('trip_members').select('role, trips(id, name, start_date, end_date, status)').eq('user_id', user.id),
      ]);
      end?.();
      if (profileRes.error) throw profileRes.error;
      if (memberRes.error) throw memberRes.error;
      const rows: TripRow[] = (memberRes.data ?? []).map((m: { role: string; trips: { id: string; name: string; start_date: string; end_date: string; status: string } | null }) => ({
        id: m.trips?.id ?? '', name: m.trips?.name ?? '', start_date: m.trips?.start_date ?? '',
        end_date: m.trips?.end_date ?? '', status: m.trips?.status ?? '', role: m.role,
      })).filter(r => r.id);
      setTrips(rows);
      setStats({ totalTrips: rows.length, roundsPlayed: profileRes.data?.total_rounds_played ?? 0, avgScore: profileRes.data?.avg_score ?? null, yoyDelta: null });
      trackScreenLoad('ProfileScreen', start);
      track('screen_view_profile', { trip_count: rows.length });
    } catch (err) {
      captureException(err as Error, { screen: 'ProfileScreen', action: 'fetchData' });
      setError('Could not load your profile. Pull to refresh.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user?.id, track]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = trips.filter(t => tab === 'organizing' ? t.role === 'organizer' : t.role !== 'organizer');

  const renderTrip = ({ item, index }: { item: TripRow; index: number }) => (
    <Animated.View entering={FadeInDown.delay(50 * index).springify()}>
      <Pressable onPress={() => { track('tap_trip_from_profile', { trip_id: item.id }); router.push(`/(tabs)/placeholder` as never); }}
        accessibilityLabel={`Open trip ${item.name}`} accessibilityHint="Opens the trip itinerary"
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border })}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text }}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
          <Calendar size={13} color={colors.textSecondary} />
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary }}>{item.start_date}, {item.end_date}</Text>
          <View style={{ marginLeft: 'auto', backgroundColor: item.status === 'active' ? colors.positiveMuted : colors.surfaceSecondary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: item.status === 'active' ? colors.positive : colors.textSecondary }}>{item.status}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.text }}>Profile</Text>
        <Pressable onPress={() => { track('tap_settings_from_profile', {}); router.push('/(tabs)/settings'); }} accessibilityLabel="Open settings" accessibilityHint="Navigates to app settings" style={{ padding: 8 }}>
          <Settings size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      <FlatList data={filtered} keyExtractor={i => i.id} renderItem={renderTrip}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ListEmptyComponent={error ? <Text style={{ color: colors.error, textAlign: 'center', marginTop: 20 }}>{error}</Text> : <EmptyState icon={MapPin} title="No trips yet" subtitle="Trips you organise or join will appear here." />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.springify()}>
            <ProfileHeader user={user} stats={stats} />
            <View style={{ flexDirection: 'row', marginBottom: 14, backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 3 }}>
              {(['organizing', 'participating'] as const).map(t => (
                <Pressable key={t} onPress={() => setTab(t)} accessibilityLabel={t === 'organizing' ? 'Organizing tab' : 'Participating tab'} accessibilityHint={`Show trips you are ${t}`}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: tab === t ? colors.primary : 'transparent', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: tab === t ? colors.textOnPrimary : colors.textSecondary }}>{t === 'organizing' ? 'Organizing' : 'Participating'}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        }
      />
    </SafeAreaView>
  );
}
