import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
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

type Standing = {
  member_id: string;
  display_name: string;
  total_score: number;
  best_round: number | null;
  rounds_played: number;
};

type RoundEntry = {
  id: string;
  course_name: string;
  round_date: string;
  is_complete: boolean;
};

export default function ScoresScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [rounds, setRounds] = useState<RoundEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupAvg, setGroupAvg] = useState<number | null>(null);
  const [lowRound, setLowRound] = useState<number | null>(null);
  const startTime = React.useRef(Date.now());

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    const done = trackApiLatency('fetch_scores_leaderboard');
    try {
      const [roundsRes, scoresRes] = await Promise.all([
        supabase.from('rounds').select('id,course_name,round_date,is_complete').eq('trip_id', tripId).order('round_date'),
        supabase.from('scores').select('member_id,round_id,total_score,trip_members(guest_name,user_id,users(display_name))').eq('trip_id', tripId),
      ]);
      if (roundsRes.error) throw roundsRes.error;
      if (scoresRes.error) throw scoresRes.error;
      setRounds((roundsRes.data ?? []) as RoundEntry[]);
      const scoreRows = scoresRes.data ?? [];
      const map: Record<string, Standing> = {};
      scoreRows.forEach((s: Record<string, unknown>) => {
        const memberId = s.member_id as string;
        const member = s.trip_members as Record<string, unknown> | null;
        const userRecord = member?.users as Record<string, unknown> | null;
        const name = (userRecord?.display_name as string) ?? (member?.guest_name as string) ?? 'Player';
        const score = (s.total_score as number) ?? 0;
        if (!map[memberId]) map[memberId] = { member_id: memberId, display_name: name, total_score: 0, best_round: null, rounds_played: 0 };
        map[memberId].total_score += score;
        map[memberId].rounds_played += 1;
        if (map[memberId].best_round === null || score < map[memberId].best_round!) map[memberId].best_round = score;
      });
      const sorted = Object.values(map).sort((a, b) => a.total_score - b.total_score);
      setStandings(sorted);
      if (scoreRows.length > 0) {
        const all = scoreRows.map((s: Record<string, unknown>) => (s.total_score as number) ?? 0);
        setGroupAvg(all.reduce((a, b) => a + b, 0) / all.length);
        setLowRound(Math.min(...all));
      }
      trackScreenLoad('scores_leaderboard', startTime.current);
    } catch (err) {
      captureException(err as Error, { screen: 'scores_leaderboard', action: 'fetch' });
    } finally {
      setLoading(false);
      setRefreshing(false);
      done();
    }
  }, [tripId]);

  useEffect(() => { track('screen_view_scores_leaderboard', { trip_id: tripId }); fetchData(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={standings}
        keyExtractor={item => item.member_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }}>
              <Trophy size={22} color={colors.warning} />
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: 'PlusJakartaSans_700Bold' }}>Leaderboard</Text>
            </View>
            {groupAvg !== null && (
              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 12 }}>
                {[{ label: 'Group Avg', val: (groupAvg ?? 0).toFixed(1) }, { label: 'Low Round', val: (lowRound ?? 0).toString() }].map(stat => (
                  <View key={stat.label} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>{stat.val}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            )}
            {standings.length === 0 && <EmptyState icon="flag" title="No scores yet" subtitle="Add scores for your rounds to see standings." />}
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index).duration(350)}>
            <LeaderboardRow standing={item} rank={index + 1} isExpanded={expandedId === item.member_id}
              onPress={() => { setExpandedId(prev => prev === item.member_id ? null : item.member_id); track('expand_leaderboard_row', { member_id: item.member_id }); }} />
          </Animated.View>
        )}
        ListFooterComponent={
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 }}>Rounds</Text>
            {rounds.map(round => (
              <Pressable key={round.id} onPress={() => { track('open_score_entry', { round_id: round.id }); router.push({ pathname: '/(modal)/score-entry', params: { roundId: round.id, tripId } }); }}
                accessibilityLabel={`Add scores for ${round.course_name}`} accessibilityHint="Opens score entry sheet"
                style={({ pressed }) => ({ backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{round.course_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{round.round_date}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Plus size={14} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Add Scores</Text>
                </View>
              </Pressable>
            ))}
          </Animated.View>
        }
      />
    </SafeAreaView>
  );
}
