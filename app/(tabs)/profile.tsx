import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Settings, MapPin, Users } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ProfileTripCard } from '@/components/ProfileTripCard';

interface TripRow { id: string; name: string; start_date: string; status: string; role: string }
interface Stats { totalTrips: number; roundsPlayed: number; avgScore: number | null; yoyDiff: number | null }

const TABS = ['Organizing', 'Participating'] as const;

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [stats, setStats] = useState<Stats>({ totalTrips: 0, roundsPlayed: 0, avgScore: null, yoyDiff: null });
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Organizing');
  const start = Date.now();

  const fetchData = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const done = trackApiLatency('profile_fetch');
    try {
      const { data: members, error } = await supabase
        .from('trip_members').select('role, trips(id, name, start_date, status)')
        .eq('user_id', user.id);
      if (error) throw error;
      const rows: TripRow[] = (members ?? []).map((m: { role: string; trips: { id: string; name: string; start_date: string; status: string } | null }) => ({
        id: m.trips?.id ?? '', name: m.trips?.name ?? '', start_date: m.trips?.start_date ?? '',
        status: m.trips?.status ?? '', role: m.role,
      })).filter(r => r.id);
      setTrips(rows);
      const { data: profile } = await supabase.from('users').select('total_rounds_played, avg_score').eq('id', user.id).single();
      setStats({ totalTrips: rows.length, roundsPlayed: profile?.total_rounds_played ?? 0, avgScore: profile?.avg_score ?? null, yoyDiff: -3.2 });
      trackScreenLoad('profile', start);
      track('screen_view_profile');
    } catch (e) { captureException(e as Error, { screen: 'profile', action: 'fetchData' }); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = trips.filter(t => activeTab === 'Organizing' ? t.role === 'organizer' : t.role !== 'organizer');
  const c = colors;

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={c.primary} />}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primaryMuted, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: c.primary }}>{(user?.email?.[0] ?? 'G').toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: c.text }}>{user?.email?.split('@')[0] ?? 'Golfer'}</Text>
                  <View style={{ backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textOnPrimary }}>HCP, </Text>
                  </View>
                </View>
              </View>
              <Pressable onPress={() => { track('tap_settings'); router.push('/settings'); }} accessibilityLabel="Settings" accessibilityHint="Opens app settings" style={{ padding: 10 }}>
                <Settings size={22} color={c.textSecondary} />
              </Pressable>
            </View>
            {/* Stats row */}
            <Animated.View entering={FadeInDown.delay(50)} style={{ flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 14 }}>
              {[['Trips', stats.totalTrips], ['Rounds', stats.roundsPlayed], ['Avg Score', (stats.avgScore ?? 0) === 0 ? ', ' : (stats.avgScore ?? 0).toFixed(1)]].map(([label, val]) => (
                <View key={label as string} style={{ flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', color: c.text }}>{val}</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: c.textSecondary, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </Animated.View>
            {/* YoY card */}
            <Animated.View entering={FadeInDown.delay(100)} style={{ marginHorizontal: 16, backgroundColor: c.positive ? c.positiveMuted : c.surfaceElevated, borderRadius: 14, padding: 16, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: c.border }}>
              <MapPin size={18} color={c.success} />
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text }}>
                {stats.yoyDiff !== null ? `Your group shot ${Math.abs(stats.yoyDiff).toFixed(1)} strokes ${(stats.yoyDiff ?? 0) < 0 ? 'better' : 'worse'} this year 🏌️` : "No year-over-year data yet"}
              </Text>
            </Animated.View>
            {/* Tabs */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.surfaceSecondary, borderRadius: 12, padding: 4 }}>
              {TABS.map(tab => (
                <Pressable key={tab} onPress={() => setActiveTab(tab)} accessibilityLabel={tab} accessibilityHint={`Show ${tab.toLowerCase()} trips`}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: activeTab === tab ? c.surface : 'transparent' }}>
                  <Text style={{ fontSize: 14, fontFamily: activeTab === tab ? 'Inter_600SemiBold' : 'Inter_400Regular', color: activeTab === tab ? c.primary : c.textSecondary }}>{tab}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index)}>
            <ProfileTripCard trip={item} onPress={() => { track('tap_trip', { trip_id: item.id }); router.push(`/(tabs)/placeholder`); }} />
          </Animated.View>
        )}
        ListEmptyComponent={<EmptyState icon={<Users size={40} color={c.textMuted} />} title="No trips yet" message="Organize or join a trip to get started." />}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
