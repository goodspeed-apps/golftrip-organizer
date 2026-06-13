import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Trophy, Plus, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { LeaderboardRow } from '@/components/LeaderboardRow';

interface Standing {
  member_id: string;
  display_name: string;
  total_score: number;
  best_round: number | null;
  rounds_played: number;
  per_round: Record<string, number | null>;
}

interface RoundCard {
  id: string;
  course_name: string;
  round_date: string;
  is_complete: boolean;
  score_count: number;
}

export default function ScoresScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [rounds, setRounds] = useState<RoundCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [groupAvg, setGroupAvg] = useState<number | null>(null);
  const [lowRound, setLowRound] = useState<number | null>(null);
  const startTime = Date.now();

  const fetchData = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    try {
      const end = trackApiLatency('fetch_scores_leaderboard');
      const [roundsRes, scoresRes, membersRes] = await Promise.all([
        supabase.from('rounds').select('id, course_name, round_date, is_complete').eq('trip_id', tripId).order('round_date'),
        supabase.from('scores').select('id, round_id, member_id, total_score, score_relative_to_par').eq('trip_id', tripId),
        supabase.from('trip_members').select('id, user_id, guest_name, role').eq('trip_id', tripId),
      ]);
      end?.();
      if (roundsRes.error) throw roundsRes.error;
      if (scoresRes.error) throw scoresRes.error;
      if (membersRes.error) throw membersRes.error;

      const roundList = roundsRes.data ?? [];
      const scoreList = scoresRes.data ?? [];
      const memberList = membersRes.data ?? [];

      const roundCards: RoundCard[] = roundList.map(r => ({
        ...r,
        score_count: scoreList.filter(s => s.round_id === r.id).length,
      }));
      setRounds(roundCards);

      const map: Record<string, Standing> = {};
      memberList.forEach(m => {
        const name = m.guest_name ?? m.user_id ?? 'Unknown';
        map[m.id] = { member_id: m.id, display_name: name, total_score: 0, best_round: null, rounds_played: 0, per_round: {} };
      });
      let allScores: number[] = [];
      scoreList.forEach(s => {
        if (!map[s.member_id]) return;
        const score = s.total_score ?? 0;
        map[s.member_id].total_score += score;
        map[s.member_id].rounds_played += 1;
        map[s.member_id].per_round[s.round_id] = s.total_score;
        if (map[s.member_id].best_round === null || score < (map[s.member_id].best_round ?? Infinity)) map[s.member_id].best_round = score;
        allScores.push(score);
      });
      const sorted = Object.values(map).sort((a, b) => a.total_score - b.total_score);
      setStandings(sorted);
      if (allScores.length) { setGroupAvg(allScores.reduce((a, b) => a + b, 0) / allScores.length); setLowRound(Math.min(...allScores)); }
      setError(null);
      trackScreenLoad('scores_leaderboard', startTime);
    } catch (e) {
      captureException(e as Error, { screen: 'scores', action: 'fetchData' });
      setError('Could not load scores.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { track('screen_view_scores_leaderboard', { trip_id: tripId }); fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const openEntry = (roundId: string) => { track('tap_add_scores', { round_id: roundId }); router.push({ pathname: '/(modal)/score-entry', params: { roundId, tripId } }); };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;
  if (error) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><EmptyState icon="alert-circle" title="Something went wrong" subtitle={error} actionLabel="Retry" onAction={fetchData} /></SafeAreaView>;
  if (!standings.length && !rounds.length) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><EmptyState icon="golf" title="No rounds yet" subtitle="Add a round to start tracking scores." /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rounds}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.text, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>Leaderboard</Text>
            {groupAvg !== null && (
              <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 12 }}>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>Avg: {groupAvg.toFixed(1)}</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>Low: {lowRound ?? '-'}</Text>
              </View>
            )}
            {standings.map((s, i) => (
              <LeaderboardRow key={s.member_id} standing={s} rank={i + 1} expanded={expandedMember === s.member_id} rounds={rounds}
                onPress={() => { track('tap_leaderboard_row', { member_id: s.member_id }); setExpandedMember(p => p === s.member_id ? null : s.member_id); }} />
            ))}
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>Rounds</Text>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(350)} style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text }}>{item.course_name}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{item.round_date} · {item.score_count} scores entered</Text>
            <Pressable onPress={() => openEntry(item.id)} accessibilityLabel="Add scores for this round" accessibilityHint="Opens score entry screen"
              style={({ pressed }) => ({ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primaryMuted, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, transform: [{ scale: pressed ? withSpring(0.95) : withSpring(1) }] })}>
              <Plus size={14} color={colors.primary} />
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.primary }}>Add Scores</Text>
            </Pressable>
          </Animated.View>
        )}
        ListEmptyComponent={<EmptyState icon="flag" title="No rounds scheduled" subtitle="Rounds will appear here once added." />}
      />
      <Pressable onPress={() => openEntry('')} accessibilityLabel="Quick add scores" accessibilityHint="Opens score entry for a new round"
        style={{ position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: colors.shadow, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        <Plus size={26} color={colors.textOnPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}
