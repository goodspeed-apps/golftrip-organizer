import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
import { Crown, Share2, Download, Lock, Trophy, Star } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePaywall } from '@/hooks/usePaywall';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { RecapCard } from '@/components/RecapCard';

type RecapData = {
  tripName: string;
  startDate: string;
  endDate: string;
  courses: string[];
  winnerName: string;
  bestScore: number;
  groupAvg: number;
  costPerPerson: number;
  recapUnlocked: boolean;
};

export default function TripRecapScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { presentPaywall } = usePaywall();
  const { toast, showToast } = useToast();

  const [recap, setRecap] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const scaleShare = useSharedValue(1);
  const scaleDownload = useSharedValue(1);

  const shareStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleShare.value }] }));
  const downloadStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleDownload.value }] }));

  useEffect(() => {
    const start = Date.now();
    track('screen_view_trip_recap', { tripId });

    const fetchRecap = async () => {
      if (!tripId) { setLoading(false); return; }
      const end = trackApiLatency('fetch_trip_recap');
      try {
        const [{ data: trip, error: tripErr }, { data: recapRow, error: recapErr }, { data: teeTimes }] =
          await Promise.all([
            supabase.from('trips').select('name,start_date,end_date,recap_unlocked').eq('id', tripId).single(),
            supabase.from('trip_recaps').select('*').eq('trip_id', tripId).maybeSingle(),
            supabase.from('tee_times').select('course_name').eq('trip_id', tripId),
          ]);
        if (tripErr) throw tripErr;
        if (recapErr) throw recapErr;
        const winnerName = recapRow?.winner_member_id
          ? (await supabase.from('trip_members').select('guest_name,users(display_name)').eq('id', recapRow.winner_member_id).single())?.data?.guest_name ?? 'Unknown'
          : ', ';
        const uniqueCourses = [...new Set((teeTimes ?? []).map((t: { course_name: string }) => t.course_name))];
        setRecap({
          tripName: trip?.name ?? 'Golf Trip',
          startDate: trip?.start_date ?? '',
          endDate: trip?.end_date ?? '',
          courses: uniqueCourses,
          winnerName,
          bestScore: recapRow?.best_round_score ?? 0,
          groupAvg: recapRow?.group_avg_score ?? 0,
          costPerPerson: (recapRow?.total_cost_per_person_cents ?? 0) / 100,
          recapUnlocked: trip?.recap_unlocked ?? false,
        });
        trackScreenLoad('TripRecap', start);
      } catch (e) {
        captureException(e as Error, { screen: 'TripRecap', action: 'fetchRecap' });
        setError('Could not load recap.');
      } finally {
        end();
        setLoading(false);
      }
    };
    fetchRecap();
  }, [tripId]);

  const handleUnlock = async () => {
    setPurchasing(true);
    track('tap_unlock_recap', { tripId });
    try {
      await presentPaywall('trip_recap_299');
      await supabase.from('trips').update({ recap_unlocked: true }).eq('id', tripId);
      setRecap(prev => prev ? { ...prev, recapUnlocked: true } : prev);
      track('recap_unlocked', { tripId });
    } catch (e) {
      captureException(e as Error, { screen: 'TripRecap', action: 'unlock' });
      showToast('Purchase failed. Please try again.', 'error');
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    scaleShare.value = withSpring(0.97, { damping: 15 }, () => { scaleShare.value = withSpring(1); });
    track('tap_share_recap', { tripId });
    try {
      await Share.share({ message: `🏌️ ${recap?.tripName} Recap\n🏆 Winner: ${recap?.winnerName}\n⛳ Best Round: ${recap?.bestScore}\nGenerated with GolfTrip Organizer` });
    } catch (e) { captureException(e as Error, { screen: 'TripRecap', action: 'share' }); }
  };

  const handleDownload = async () => {
    scaleDownload.value = withSpring(0.97, { damping: 15 }, () => { scaleDownload.value = withSpring(1); });
    track('tap_download_recap', { tripId });
    showToast('Saved to Photos', 'success');
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="card" /></SafeAreaView>;
  if (error || !recap) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState icon={<Trophy size={48} color={colors.textSecondary} />} title="Recap Unavailable" subtitle={error ?? 'No recap data found for this trip.'} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast toast={toast} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.text, marginBottom: 4 }}>Trip Recap</Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, marginBottom: 20 }}>{recap.tripName}</Text>

          <View style={{ position: 'relative' }}>
            <RecapCard recap={recap} blurred={!recap.recapUnlocked} />
            {!recap.recapUnlocked && (
              <View style={{ position: 'absolute', inset: 0, borderRadius: 20, backgroundColor: colors.shadow, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Animated.View entering={FadeInDown.delay(200)}>
                  <Lock size={36} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: colors.text, textAlign: 'center', marginBottom: 8 }}>Unlock Recap</Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                    {"Get your shareable trip card with winner, scores & costs."}
                  </Text>
                  <Pressable
                    onPress={handleUnlock}
                    disabled={purchasing}
                    accessibilityLabel="Unlock Recap for $2.99"
                    accessibilityHint="Opens purchase flow to unlock your trip recap card"
                    style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', minHeight: 44 }}
                  >
                    {purchasing
                      ? <ActivityIndicator color={colors.textOnPrimary} />
                      : <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.textOnPrimary }}>Unlock for $2.99</Text>
                    }
                  </Pressable>
                </Animated.View>
              </View>
            )}
          </View>

          {recap.recapUnlocked && (
            <Animated.View entering={FadeInDown.delay(300)} style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Animated.View style={[{ flex: 1 }, shareStyle]}>
                <Pressable
                  onPress={handleShare}
                  accessibilityLabel="Share recap"
                  accessibilityHint="Opens native share sheet for your trip recap"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, minHeight: 44, gap: 8 }}
                >
                  <Share2 size={18} color={colors.textOnPrimary} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.textOnPrimary }}>Share</Text>
                </Pressable>
              </Animated.View>
              <Animated.View style={[{ flex: 1 }, downloadStyle]}>
                <Pressable
                  onPress={handleDownload}
                  accessibilityLabel="Download recap image"
                  accessibilityHint="Saves recap card image to your camera roll"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 14, minHeight: 44, gap: 8, borderWidth: 1, borderColor: colors.border }}
                >
                  <Download size={18} color={colors.primary} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.primary }}>Download</Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
