import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const start = Date.now();

  const fetchData = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    try {
      const done = trackApiLatency('fetch_scores_leaderboard');
      const [roundsRes, scoresRes, membersRes] = await Promise.all([
        supabase.from('rounds').select('id,course_name,round_date,is_complete').eq('trip_id', tripId).order('round_date'),
        supabase.from('scores').select('*').eq('trip_id', tripId),
        supabase.from('trip_members').select('id,user_id,guest_name').eq('trip_id', tripId),
      ]);
      done();
      if (roundsRes.error) throw roundsRes.error;
      if (scoresRes.error) throw scoresRes.error;
      if (membersRes.error) throw membersRes.error;
      setRounds(roundsRes.data ?? []);
      const memberMap: Record<string, string> = {};
      (membersRes.data ?? []).forEach(m => { memberMap[m.id] = m.guest_name ?? m.user_id ?? 'Guest'; });
      const byMember: Record<string, Standing> = {};
      (scoresRes.data ?? []).forEach(s => {
        if (!byMember[s.member_id]) byMember[s.member_id] = { member_id: s.member_id, display_name: memberMap[s.member_id] ?? 'Player', total_score: 0, best_round: null, rounds_played: 0, per_round: {} };
        const sc = s.total_score ?? 0;
        byMember[s.member_id].total_score += sc;
        byMember[s.member_id].rounds_played += 1;
        byMember[s.member_id].best_round = byMember[s.member_id].best_round === null ? sc : Math.min(byMember[s.member_id].best_round!, sc);
        byMember[s.member_id].per_round[s.round_id] = sc;
      });
      setStandings(Object.values(byMember).sort((a, b) => a.total_score - b.total_score));
      trackScreenLoad('scores_leaderboard', start);
    } catch (e) {
      captureException(e as Error, { screen: 'scores_leaderboard', action: 'fetch' });
      setError('Could not load scores.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { track('screen_view_scores_leaderboard', { trip_id: tripId }); fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };
  const toggleExpand = (id: string) => { track('leaderboard_row_expand', { member_id: id }); setExpanded(prev => prev === id ? null : id); };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;
  if (error) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><EmptyState icon="alert-circle" title="Something went wrong" subtitle={error} actionLabel="Retry" onAction={fetchData} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={standings}
        keyExtractor={i => i.member_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={{ padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Leaderboard</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{standings.length} players · {rounds.length} rounds</Text>
            </View>
            {standings.length === 0 && <EmptyState icon="flag" title="No scores yet" subtitle="Add scores for the first round to see standings." />}
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index).duration(300)}>
            <LeaderboardRow standing={item} rank={index + 1} expanded={expanded === item.member_id} rounds={rounds} onToggle={() => toggleExpand(item.member_id)} isWinner={index === 0 && standings.length > 1} />
          </Animated.View>
        )}
        ListFooterComponent={
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 4 }}>Rounds</Text>
            {rounds.map(r => (
              <Pressable key={r.id} onPress={() => { track('open_score_entry', { round_id: r.id }); router.push({ pathname: '/(modal)/score-entry', params: { round_id: r.id, trip_id: tripId } }); }} accessibilityLabel={`Add scores for ${r.course_name}`} accessibilityHint="Opens score entry modal" style={({ pressed }) => ({ backgroundColor: colors.card, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 })}>
                <View>
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{r.course_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{r.round_date}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, color: r.is_complete ? colors.success : colors.warning }}>{r.is_complete ? 'Complete' : 'In Progress'}</Text>
                  <Plus size={18} color={colors.primary} />
                </View>
              </Pressable>
            ))}
          </View>
        }
      />
    </SafeAreaView>
  );
}
