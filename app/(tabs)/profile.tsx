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
      const rows: TripRow[] = (members ?? []).map((m: { role: string; trips: { id: string; name: string; start_date: string; status: string } | { id: string; name: string; start_date: string; status: string }[] | null }) => {
        const tripData = Array.isArray(m.trips) ? m.trips[0] : m.trips;
        return {
          id: tripData?.id ?? '',
          name: tripData?.name ?? '',
          start_date: tripData?.start_date ?? '',
          status: tripData?.status ?? '',
          role: m.role,
        };
      }).filter((r: TripRow) => r.id);
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
                  <Text style={{ fontSize: 22, fontWeight: '700', color: c.primary }}>
                    {user?.user_metadata?.display_name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>
                    {user?.user_metadata?.display_name ?? 'Golfer'}
                  </Text>
                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>{user?.email}</Text>
                </View>
              </View>
              <Pressable onPress={() => router.push('/(modal)/settings')} style={{ padding: 8 }}>
                <Settings size={22} color={c.textSecondary} />
              </Pressable>
            </View>

            {/* Stats */}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 20 }}>
              {[
                { label: 'Trips', value: stats.totalTrips },
                { label: 'Rounds', value: stats.roundsPlayed },
                { label: 'Avg Score', value: stats.avgScore ?? '—' },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{s.value}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Tabs */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 }}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                    backgroundColor: activeTab === tab ? c.primary : c.card,
                  }}
                >
                  <Text style={{ color: activeTab === tab ? '#fff' : c.textSecondary, fontWeight: '600' }}>{tab}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Animated.View entering={FadeInDown} style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            <ProfileTripCard trip={item} onPress={() => router.push(`/(tabs)/trip/${item.id}/itinerary`)} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            title={activeTab === 'Organizing' ? 'No trips organized' : 'Not participating in any trips'}
            description="Trips you join or create will appear here."
          />
        }
      />
    </SafeAreaView>
  );
}
