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
  const themeContext = useThemeColors();
  const c = themeContext.colors;
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
              <View>
                <Text style={{ fontSize: 26, fontWeight: '800', color: c.text }}>Profile</Text>
                <Text style={{ fontSize: 14, color: c.textSecondary }}>{user?.email}</Text>
              </View>
              <Pressable onPress={() => router.push('/(tabs)/settings' as never)} style={{ padding: 8 }}>
                <Settings size={22} color={c.text} />
              </Pressable>
            </View>

            {/* Stats */}
            <View style={{ flexDirection: 'row', padding: 16, gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: c.primary }}>{stats.totalTrips}</Text>
                <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>Trips</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: c.primary }}>{stats.roundsPlayed}</Text>
                <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>Rounds</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: c.primary }}>{stats.avgScore ?? '—'}</Text>
                <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>Avg Score</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.card, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: c.border }}>
              {TABS.map(tab => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                    backgroundColor: activeTab === tab ? c.primary : 'transparent',
                  }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 14, color: activeTab === tab ? '#fff' : c.textSecondary }}>
                    {tab}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={MapPin}
            title={activeTab === 'Organizing' ? 'No trips organized' : 'Not participating in any trips'}
            description={activeTab === 'Organizing' ? 'Create your first trip to get started!' : 'Join a trip using an invite code.'}
          />
        }
        renderItem={({ item }) => (
          <Animated.View entering={FadeInDown.springify()} style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            <ProfileTripCard
              trip={item}
              onPress={() => router.push(`/(tabs)/trip/${item.id}/itinerary` as never)}
            />
          </Animated.View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}
