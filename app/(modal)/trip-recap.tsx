import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Trophy, Star, DollarSign, Flag, X, Lock } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePaywall } from '@/hooks/usePaywall';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';
import { RecapCard } from '@/components/RecapCard';

interface RecapData {
  tripName: string;
  startDate: string;
  endDate: string;
  courses: string[];
  winnerName: string;
  bestRoundScore: number | null;
  groupAvgScore: number | null;
  totalCostPerPerson: number | null;
  totalRounds: number;
  recapUnlocked: boolean;
}

export default function TripRecapScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { showPaywall } = usePaywall();
  const { showToast } = useToast();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [recap, setRecap] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const fetchRecap = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const start = Date.now();
    try {
      const end = trackApiLatency('fetch_trip_recap');
      const [tripRes, teeRes, recapRes] = await Promise.all([
        supabase.from('trips').select('name, start_date, end_date, recap_unlocked').eq('id', tripId).single(),
        supabase.from('tee_times').select('course_name').eq('trip_id', tripId),
        supabase.from('trip_recaps').select('*').eq('trip_id', tripId).maybeSingle(),
      ]);
      end();
      if (tripRes.error) throw tripRes.error;
      const trip = tripRes.data;
      const courses = [...new Set((teeRes.data ?? []).map((t) => t.course_name as string))];
      let winnerName = 'TBD';
      if (recapRes.data?.winner_member_id) {
        const { data: member } = await supabase
          .from('trip_members').select('guest_name, users(display_name)').eq('id', recapRes.data.winner_member_id).single();
        winnerName = (member as { guest_name?: string; users?: { display_name?: string } } | null)?.users?.display_name ?? member?.guest_name ?? 'TBD';
      }
      const roundsRes = await supabase.from('rounds').select('id').eq('trip_id', tripId);
      setRecap({
        tripName: trip.name,
        startDate: trip.start_date,
        endDate: trip.end_date,
        courses,
        winnerName,
        bestRoundScore: recapRes.data?.best_round_score ?? null,
        groupAvgScore: recapRes.data?.group_avg_score ?? null,
        totalCostPerPerson: recapRes.data?.total_cost_per_person_cents ?? null,
        totalRounds: roundsRes.data?.length ?? 0,
        recapUnlocked: trip.recap_unlocked ?? false,
      });
      trackScreenLoad('TripRecap', start);
    } catch (err) {
      captureException(err as Error, { screen: 'TripRecap', action: 'fetchRecap' });
      setError('Failed to load trip recap.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    track('screen_view_trip_recap', { trip_id: tripId });
    fetchRecap();
  }, [fetchRecap]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchRecap(); }, [fetchRecap]);

  const handleUnlock = async () => {
    if (!tripId || !user) return;
    setPurchasing(true);
    try {
      const { showPaywall: _show } = usePaywall as unknown as { showPaywall: (productId: string) => Promise<boolean> };
      const purchased = await showPaywall();
      if (purchased) {
        const { error } = await supabase.from('trips').update({ recap_unlocked: true }).eq('id', tripId);
        if (!error) {
          setRecap(prev => prev ? { ...prev, recapUnlocked: true } : prev);
          showToast('Trip recap unlocked!', 'success');
        }
      }
    } catch (e) {
      captureException(e as Error, { screen: 'TripRecap', action: 'handleUnlock' });
      showToast('Purchase failed. Please try again.', 'error');
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    if (!recap) return;
    try {
      await Share.share({
        message: `🏌️ ${recap.tripName} Recap\n📅 ${recap.startDate} – ${recap.endDate}\n🏆 Winner: ${recap.winnerName}\n⛳ ${recap.totalRounds} rounds played`,
        title: `${recap.tripName} Trip Recap`,
      });
      track('share_recap', { trip_id: tripId });
    } catch (e) {
      captureException(e as Error, { screen: 'TripRecap', action: 'handleShare' });
    }
  };

  const c = colors as unknown as Record<string, string>;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  if (error || !recap) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <EmptyState title="Something went wrong" description={error ?? 'Could not load recap'} icon="alert" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Trip Recap</Text>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <X size={24} color={c.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(350)}>
          <RecapCard recap={recap} colors={c} />
        </Animated.View>

        {!recap.recapUnlocked && (
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Animated.View style={pressStyle}>
              <Pressable
                onPress={handleUnlock}
                onPressIn={() => { scale.value = withSpring(0.97); }}
                onPressOut={() => { scale.value = withSpring(1); }}
                disabled={purchasing}
                style={{ backgroundColor: c.primary, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 }}
              >
                {purchasing
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <>
                      <Lock size={24} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Unlock Full Recap</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>One-time purchase per trip</Text>
                    </>
                  )
                }
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}

        {recap.recapUnlocked && (
          <Animated.View entering={FadeInDown.delay(200).duration(350)}>
            <Pressable
              onPress={handleShare}
              style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: c.border }}
            >
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>Share Recap</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
