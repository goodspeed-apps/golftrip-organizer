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
  const { colors } = useThemeColors();
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
      captureException(err, { screen: 'TripRecap', action: 'fetchRecap' });
      setError('Failed to load trip recap.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    track('screen_view_trip_recap', { trip_id: tripId });
    fetchRecap();
  }, [tripId]);

  const handleUnlock = async () => {
    setPurchasing(true);
    try {
      const purchased = await showPaywall('trip_recap');
      if (purchased) {
        await supabase.from('trips').update({ recap_unlocked: true }).eq('id', tripId ?? '');
        await fetchRecap();
        showToast({ type: 'success', message: 'Trip Recap unlocked!' });
        track('recap_unlocked', { trip_id: tripId });
      }
    } catch (e) {
      captureException(e as Error, { screen: 'TripRecap', action: 'handleUnlock' });
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    if (!recap) return;
    try {
      const courseList = recap.courses.join(', ') || 'Multiple courses';
      const msg = `🏌️ ${recap.tripName} Recap\n📅 ${recap.startDate} – ${recap.endDate}\n⛳ Courses: ${courseList}\n🏆 Winner: ${recap.winnerName}\n🔢 Rounds: ${recap.totalRounds}`;
      await Share.share({ message: msg });
      track('recap_shared', { trip_id: tripId });
    } catch (e) {
      captureException(e as Error, { screen: 'TripRecap', action: 'handleShare' });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="card" count={4} />
      </SafeAreaView>
    );
  }

  if (error || !recap) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState title="Error" description={error ?? 'No recap data available.'} />
      </SafeAreaView>
    );
  }

  const statCards = [
    { icon: <Trophy size={20} color={colors.primary} />, label: 'Winner', value: recap.winnerName },
    { icon: <Flag size={20} color={colors.primary} />, label: 'Rounds Played', value: String(recap.totalRounds) },
    { icon: <Star size={20} color={colors.primary} />, label: 'Best Round', value: recap.bestRoundScore != null ? String(recap.bestRoundScore) : 'N/A' },
    { icon: <Star size={20} color={colors.primary} />, label: 'Group Avg Score', value: recap.groupAvgScore != null ? recap.groupAvgScore.toFixed(1) : 'N/A' },
    { icon: <DollarSign size={20} color={colors.primary} />, label: 'Cost Per Person', value: recap.totalCostPerPerson != null ? `$${(recap.totalCostPerPerson / 100).toFixed(2)}` : 'N/A' },
    { icon: <Flag size={20} color={colors.primary} />, label: 'Courses', value: recap.courses.join(', ') || 'N/A' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <X size={24} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 }}>{recap.tripName} Recap</Text>
        <Pressable onPress={handleShare} style={{ padding: 8 }}>
          <Star size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecap(); }} />}
      >
        {!recap.recapUnlocked && (
          <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 20, marginBottom: 20, alignItems: 'center' }}>
            <Lock size={32} color={colors.primary} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Unlock Full Recap</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>
              Get detailed stats, winner breakdown, and a shareable trip summary.
            </Text>
            <Animated.View style={pressStyle}>
              <Pressable
                onPress={handleUnlock}
                onPressIn={() => { scale.value = withSpring(0.96); }}
                onPressOut={() => { scale.value = withSpring(1); }}
                style={{ backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 }}
                disabled={purchasing}
              >
                {purchasing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Unlock Recap</Text>
                }
              </Pressable>
            </Animated.View>
          </View>
        )}

        {statCards.map((card, index) => (
          <Animated.View key={card.label} entering={FadeInDown.delay(index * 80)}>
            <RecapCard
              icon={card.icon}
              label={card.label}
              value={card.value}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
