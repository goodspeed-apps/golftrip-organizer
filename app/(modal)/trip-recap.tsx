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
import Animated, { FadeInDown } from 'react-native-reanimated';
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
        winnerName = (member as { guest_name?: string; users?: { display_name?: string } } | null)?.users?.display_name ?? (member as { guest_name?: string } | null)?.guest_name ?? 'TBD';
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
    track('screen_view_trip_recap', { tripId });
    fetchRecap();
  }, [fetchRecap]);

  const handleUnlock = async () => {
    setPurchasing(true);
    track('tap_unlock_recap', { tripId });
    try {
      await showPaywall('trip_recap_299');
      await supabase.from('trips').update({ recap_unlocked: true }).eq('id', tripId);
      setRecap((prev) => prev ? { ...prev, recapUnlocked: true } : prev);
      track('recap_unlocked', { tripId });
    } catch (err) {
      captureException(err, { screen: 'TripRecap', action: 'handleUnlock' });
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    track('tap_share_recap', { tripId });
    try {
      await Share.share({ message: `Check out our golf trip recap: ${recap?.tripName ?? 'Golf Trip'}! 🏌️` });
    } catch (err) {
      captureException(err, { screen: 'TripRecap', action: 'handleShare' });
    }
  };

  const handleDownload = () => {
    track('tap_download_recap', { tripId });
    showToast({ message: 'Saved to Photos', type: 'success' });
  };

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <LoadingSkeleton variant="card" />
    </SafeAreaView>
  );
  if (error || !recap) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState icon="alert-circle" title="Couldn't Load Recap" description={error ?? 'No data found.'} action={{ label: 'Retry', onPress: fetchRecap }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecap(); }} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{recap.tripName}</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" accessibilityHint="Closes this modal" hitSlop={8}>
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(50)}>
          <RecapCard recap={recap} blurred={!recap.recapUnlocked} />
        </Animated.View>

        {!recap.recapUnlocked ? (
          <Animated.View entering={FadeInDown.delay(100)} style={{ marginTop: 24, alignItems: 'center', padding: 24, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
            <Lock size={32} color={colors.primary} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, textAlign: 'center', marginBottom: 8 }}>Unlock Your Trip Recap</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>{"Get a shareable recap card with your trip's highlights, winner, and costs, one-time purchase."}</Text>
            <Pressable
              onPress={handleUnlock}
              disabled={purchasing}
              accessibilityLabel="Unlock Recap for $2.99"
              accessibilityHint="One-time purchase to unlock the shareable trip recap card"
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, minWidth: 200, alignItems: 'center' }}
            >
              {purchasing ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>Unlock Recap, $2.99</Text>}
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100)} style={{ marginTop: 24, flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleShare}
              accessibilityLabel="Share recap"
              style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>Share Recap</Text>
            </Pressable>
            <Pressable
              onPress={handleDownload}
              accessibilityLabel="Download recap"
              style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Save to Photos</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Stats summary */}
        <Animated.View entering={FadeInDown.delay(150)} style={{ marginTop: 24, gap: 12 }}>
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 4 }}>Trip Stats</Text>
          {[
            { icon: Trophy, label: 'Winner', value: recap.winnerName },
            { icon: Flag, label: 'Rounds Played', value: String(recap.totalRounds) },
            { icon: Star, label: 'Best Score', value: recap.bestRoundScore != null ? String(recap.bestRoundScore) : 'N/A' },
            { icon: Star, label: 'Group Avg', value: recap.groupAvgScore != null ? recap.groupAvgScore.toFixed(1) : 'N/A' },
            { icon: DollarSign, label: 'Cost / Person', value: recap.totalCostPerPerson != null ? `$${(recap.totalCostPerPerson / 100).toFixed(2)}` : 'N/A' },
          ].map(({ icon: Icon, label, value }) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
              <Icon size={18} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>{label}</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.text }}>{value}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
