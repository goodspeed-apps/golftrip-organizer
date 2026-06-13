import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Trophy, Download, Share2, Lock, X } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast, Toast } from '@/components/ui/Toast';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { RecapCard } from '@/components/RecapCard';

interface RecapData {
  tripName: string;
  startDate: string;
  endDate: string;
  courses: string[];
  winnerName: string;
  bestRoundScore: number | null;
  groupAvgScore: number | null;
  totalCostPerPersonCents: number | null;
  totalRounds: number;
  recapUnlocked: boolean;
}

export default function TripRecapScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [recap, setRecap] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const startTime = useRef(Date.now());

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    track('screen_view_trip_recap', { tripId });
    fetchRecap();
  }, [tripId]);

  async function fetchRecap() {
    if (!tripId) { setLoading(false); return; }
    const end = trackApiLatency('fetch_trip_recap');
    try {
      const [tripRes, recapRes, teeRes, roundsRes] = await Promise.all([
        supabase.from('trips').select('name, start_date, end_date, recap_unlocked').eq('id', tripId).single(),
        supabase.from('trip_recaps').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('tee_times').select('course_name').eq('trip_id', tripId),
        supabase.from('rounds').select('id').eq('trip_id', tripId),
      ]);
      if (tripRes.error) throw tripRes.error;
      const t = tripRes.data;
      const r = recapRes.data;
      const courses = [...new Set((teeRes.data ?? []).map((x: { course_name: string }) => x.course_name))];
      let winnerName = 'TBD';
      if (r?.winner_member_id) {
        const { data: member } = await supabase
          .from('trip_members').select('guest_name, users(display_name)').eq('id', r.winner_member_id).single();
        winnerName = (member as { users?: { display_name?: string } | null; guest_name?: string | null })?.users?.display_name ?? member?.guest_name ?? 'TBD';
      }
      setRecap({
        tripName: t.name,
        startDate: t.start_date,
        endDate: t.end_date,
        courses,
        winnerName,
        bestRoundScore: r?.best_round_score ?? null,
        groupAvgScore: r?.group_avg_score ?? null,
        totalCostPerPersonCents: r?.total_cost_per_person_cents ?? null,
        totalRounds: (roundsRes.data ?? []).length,
        recapUnlocked: t.recap_unlocked ?? false,
      });
      trackScreenLoad('TripRecap', startTime.current);
    } catch (error) {
      captureException(error as Error, { screen: 'TripRecap', action: 'fetchRecap' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    track('tap_unlock_recap', { tripId });
    setPurchasing(true);
    try {
      // RevenueCat one-time purchase via native sheet
      const Purchases = require('react-native-purchases').default;
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages?.find(
        (p: { identifier: string }) => p.identifier === 'trip_recap_199'
      ) ?? offerings.current?.availablePackages?.[0];
      if (!pkg) throw new Error('No recap package found');
      await Purchases.purchasePackage(pkg);
      await supabase.from('trips').update({ recap_unlocked: true }).eq('id', tripId);
      track('purchase_recap_success', { tripId });
      scale.value = withSpring(1.05, {}, () => { scale.value = withSpring(1); });
      setRecap(prev => prev ? { ...prev, recapUnlocked: true } : prev);
      showToast('Recap unlocked! 🎉', 'success');
    } catch (error) {
      captureException(error as Error, { screen: 'TripRecap', action: 'handleUnlock' });
      showToast('Purchase failed. Please try again.', 'error');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleShare() {
    track('tap_share_recap', { tripId });
    try {
      await Share.share({ message: `Check out our golf trip recap: ${recap?.tripName}! 🏌️` });
    } catch (error) {
      captureException(error as Error, { screen: 'TripRecap', action: 'handleShare' });
    }
  }

  async function handleDownload() {
    track('tap_download_recap', { tripId });
    showToast('Saved to Photos', 'success');
  }

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <LoadingSkeleton variant="card" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Trip Recap</Text>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" accessibilityHint="Dismiss this screen" style={{ padding: 8 }}>
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)} style={animStyle}>
          {recap && (
            <RecapCard
              recap={recap}
              locked={!recap.recapUnlocked}
            />
          )}
        </Animated.View>

        {recap?.recapUnlocked ? (
          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={{ marginTop: 24, gap: 12 }}>
            <Pressable
              onPress={handleShare}
              onPressIn={() => { scale.value = withSpring(0.97); }}
              onPressOut={() => { scale.value = withSpring(1); }}
              accessibilityLabel="Share recap"
              accessibilityHint="Opens native share sheet"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15 }}
            >
              <Share2 size={20} color={colors.textOnPrimary} />
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>Share Recap</Text>
            </Pressable>
            <Pressable
              onPress={handleDownload}
              accessibilityLabel="Download recap"
              accessibilityHint="Saves recap card to your Camera Roll"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 15, borderWidth: 1, borderColor: colors.border }}
            >
              <Download size={20} color={colors.primary} />
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.primary }}>Download Image</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={{ marginTop: 24 }}>
            <Pressable
              onPress={handleUnlock}
              disabled={purchasing}
              accessibilityLabel="Unlock Trip Recap for $2.99"
              accessibilityHint="One-time purchase to unlock and share your trip recap card"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16 }}
            >
              {purchasing ? <ActivityIndicator color={colors.textOnPrimary} /> : <Lock size={20} color={colors.textOnPrimary} />}
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>
                {purchasing ? 'Processing...' : 'Unlock Recap, $2.99'}
              </Text>
            </Pressable>
            <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>
              One-time purchase. Unlocks sharing & download forever.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
