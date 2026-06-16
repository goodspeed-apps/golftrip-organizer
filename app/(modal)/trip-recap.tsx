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
  const colorsContext = useThemeColors();
  const colors = colorsContext.colors ?? colorsContext;
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
  }, [fetchRecap]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchRecap(); }, [fetchRecap]);

  const handleUnlock = async () => {
    if (!user || !tripId) return;
    setPurchasing(true);
    scale.value = withSpring(0.95, {}, () => { scale.value = withSpring(1); });
    try {
      const result = await showPaywall(tripId);
      if (result) {
        await fetchRecap();
        showToast('Trip recap unlocked!', 'success');
      }
    } catch (err) {
      captureException(err, { screen: 'TripRecap', action: 'handleUnlock' });
      showToast('Purchase failed. Please try again.', 'error');
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    if (!recap) return;
    try {
      await Share.share({
        message: `Check out our trip recap for ${recap.tripName}! 🏌️\n\nWinner: ${recap.winnerName}\nRounds: ${recap.totalRounds}\nCourses: ${recap.courses.join(', ')}`,
      });
      track('share_trip_recap', { trip_id: tripId });
    } catch (err) {
      captureException(err, { screen: 'TripRecap', action: 'handleShare' });
    }
  };

  const themeColors = colors as Record<string, string>;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <LoadingSkeleton variant="card" />
      </SafeAreaView>
    );
  }

  if (error || !recap) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
          <Pressable onPress={() => router.back()}><X size={24} color={themeColors.text} /></Pressable>
        </View>
        <EmptyState title="Couldn't Load Recap" subtitle={error ?? 'No recap data available.'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: themeColors.text }}>Trip Recap</Text>
        <Pressable onPress={() => router.back()} hitSlop={8}><X size={24} color={themeColors.text} /></Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(350)}>
          <RecapCard
            title={recap.tripName}
            subtitle={`${recap.startDate} → ${recap.endDate}`}
            icon={<Flag size={24} color={themeColors.primary} />}
          />
        </Animated.View>

        {recap.recapUnlocked ? (
          <>
            <Animated.View entering={FadeInDown.delay(60).duration(350)}>
              <RecapCard
                title="Winner 🏆"
                subtitle={recap.winnerName}
                icon={<Trophy size={24} color="#F59E0B" />}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(350)}>
              <RecapCard
                title="Best Round"
                subtitle={recap.bestRoundScore != null ? `${recap.bestRoundScore} strokes` : 'N/A'}
                icon={<Star size={24} color="#8B5CF6" />}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(180).duration(350)}>
              <RecapCard
                title="Cost Per Person"
                subtitle={recap.totalCostPerPerson != null ? `$${(recap.totalCostPerPerson / 100).toFixed(2)}` : 'N/A'}
                icon={<DollarSign size={24} color="#10B981" />}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(240).duration(350)}>
              <Pressable
                onPress={handleShare}
                style={{
                  backgroundColor: themeColors.primary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Share Recap</Text>
              </Pressable>
            </Animated.View>
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(60).duration(350)} style={pressStyle}>
            <Pressable
              onPress={handleUnlock}
              disabled={purchasing}
              style={{
                backgroundColor: themeColors.primary,
                borderRadius: 14,
                padding: 20,
                alignItems: 'center',
                gap: 8,
              }}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Lock size={24} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Unlock Full Recap</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>One-time purchase per trip</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
