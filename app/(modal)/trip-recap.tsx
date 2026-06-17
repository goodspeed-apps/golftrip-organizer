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
  const themeContext = useThemeColors();
  const colors = themeContext.colors;
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
      const end = trackApiLatency('fetch_trip_recap', start);
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

  const handleUnlock = useCallback(async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      scale.value = withSpring(0.96, {}, () => { scale.value = withSpring(1); });
      await showPaywall('trip_recap');
      track('paywall_shown', { source: 'trip_recap' });
    } catch (err) {
      captureException(err as Error, { screen: 'TripRecap', action: 'handleUnlock' });
      showToast('Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }, [purchasing, showPaywall]);

  const handleShare = useCallback(async () => {
    if (!recap) return;
    try {
      await Share.share({
        message: `🏌️ ${recap.tripName} Recap\n🏆 Winner: ${recap.winnerName}\n⛳ ${recap.totalRounds} rounds played\n📍 ${recap.courses.join(', ')}`,
      });
      track('share_recap', { trip_id: tripId });
    } catch (err) {
      captureException(err as Error, { screen: 'TripRecap', action: 'handleShare' });
    }
  }, [recap]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  if (error || !recap) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState icon={Trophy} title="No Recap Yet" description={error ?? 'The trip recap is not available yet.'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <X size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{recap.tripName}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{recap.startDate} – {recap.endDate}</Text>
          </View>
        </View>

        {recap.recapUnlocked ? (
          <>
            <RecapCard recap={recap} onShare={handleShare} />
          </>
        ) : (
          <Animated.View style={[pressStyle, { backgroundColor: colors.card, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border }]}>
            <Lock size={40} color={colors.primary} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
              Unlock Trip Recap
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Get detailed stats, leaderboards, and shareable highlights for this trip.
            </Text>
            <Pressable
              onPress={handleUnlock}
              disabled={purchasing}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                {purchasing ? 'Loading…' : 'Unlock Recap'}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
