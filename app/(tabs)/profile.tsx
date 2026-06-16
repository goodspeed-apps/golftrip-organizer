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
      const rows: TripRow[] = (members ?? []).flatMap((m: { role: string; trips: { id: string; name: string; start_date: string; status: string }[] }) => {
        const tripArr = Array.isArray(m.trips) ? m.trips : (m.trips ? [m.trips as unknown as { id: string; name: string; start_date: string; status: string }] : []);
        return tripArr.map((t) => ({
          id: t.id ?? '',
          name: t.name ?? '',
          start_date: t.start_date ?? '',
          status: t.status ?? '',
          role: m.role,
        }));
      }).filter((r: TripRow) => r.id);
      setTrips(rows);
      const { data: profile } = await supabase.from('users').select('total_rounds_played, avg_score').eq('id', user.id).single();
      setStats({ totalTrips: rows.length, roundsPlayed: profile?.total_rounds_played ?? 0, avgScore: profile?.avg_score ?? null, yoyDiff: -3.2 });
      trackScreenLoad('profile', start);
      track('screen_view_profile');
    } catch (e) { captureException(e as Error, { screen: 'profile', action: 'fetchData' }); }
    finally { setLoading(false); setRefreshing(false); done(); }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = trips.filter(t => activeTab === 'Organizing' ? t.role === 'organizer' : t.role !== 'organizer');
  const c = colors.colors;

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
                  <Text style={{ fontSize: 24 }}>🏌️</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>
                    {user?.user_metadata?.display_name ?? 'Golfer'}
                  </Text>
                  <Text style={{ fontSize: 13, color: c.textSecondary }}>{user?.email}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/(tabs)/settings')}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center' }}
              >
                <Settings size={20} color={c.textSecondary} />
              </Pressable>
            </View>

            {/* Stats Row */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Trips', value: stats.totalTrips },
                { label: 'Rounds', value: stats.roundsPlayed },
                { label: 'Avg Score', value: stats.avgScore != null ? stats.avgScore.toFixed(1) : '—' },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{String(s.value)}</Text>
                  <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Tabs */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.surface, borderRadius: 10, padding: 3 }}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                    backgroundColor: activeTab === tab ? c.primary : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === tab ? '#fff' : c.textSecondary }}>
                    {tab}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Animated.View entering={FadeInDown.duration(300)}>
            <ProfileTripCard trip={item} onPress={() => router.push(`/(tabs)/trip/${item.id}/itinerary` as never)} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<MapPin size={40} color={c.textSecondary} />}
            title="No trips yet"
            description={activeTab === 'Organizing' ? "You haven't organized any trips yet." : "You haven't joined any trips yet."}
            action={{ label: 'Browse Trips', onPress: () => router.push('/(tabs)/dashboard') }}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
