import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { X, Grid, List, Save } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ScorePlayerRow } from '@/components/ScorePlayerRow';

type MemberScore = {
  memberId: string;
  displayName: string;
  totalScore: string;
  holeScores: string[];
  existingScoreId?: string;
};

type RoundInfo = {
  courseName: string;
  roundDate: string;
  tripId: string;
};

export default function ScoreEntryModal() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { roundId } = useLocalSearchParams<{ roundId: string }>();

  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [memberScores, setMemberScores] = useState<MemberScore[]>([]);
  const [holeByHole, setHoleByHole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTime = useRef(Date.now());

  const fetchRoundData = useCallback(async () => {
    if (!roundId) { setError('No round selected'); setLoading(false); return; }
    const end = trackApiLatency('fetch_round_members');
    try {
      const { data: round, error: rErr } = await supabase
        .from('rounds').select('course_name, round_date, trip_id').eq('id', roundId).single();
      if (rErr) throw rErr;
      setRoundInfo({ courseName: round.course_name, roundDate: round.round_date, tripId: round.trip_id });

      const { data: members, error: mErr } = await supabase
        .from('trip_members').select('id, user_id, guest_name, users(display_name)').eq('trip_id', round.trip_id);
      if (mErr) throw mErr;

      const { data: existing } = await supabase.from('scores').select('*').eq('round_id', roundId);
      const existingMap = new Map((existing ?? []).map((s) => [s.member_id, s]));

      setMemberScores((members ?? []).map((m) => {
        const name = m.guest_name ?? (m.users as { display_name?: string } | null)?.display_name ?? 'Guest';
        const ex = existingMap.get(m.id);
        return {
          memberId: m.id,
          displayName: name,
          totalScore: ex?.total_score?.toString() ?? '',
          holeScores: ex?.hole_scores ?? Array(18).fill(''),
          existingScoreId: ex?.id,
        };
      }));
      trackScreenLoad('ScoreEntry', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'ScoreEntry', action: 'fetchRoundData' });
      setError('Failed to load round data');
    } finally {
      setLoading(false);
      end();
    }
  }, [roundId]);

  useEffect(() => { track('screen_view_score_entry'); fetchRoundData(); }, [fetchRoundData]);

  const updateScore = (memberId: string, value: string) =>
    setMemberScores((prev) => prev.map((m) => m.memberId === memberId ? { ...m, totalScore: value } : m));

  const updateHoleScore = (memberId: string, hole: number, value: string) =>
    setMemberScores((prev) => prev.map((m) => m.memberId === memberId ? { ...m, holeScores: m.holeScores.map((h, i) => i === hole ? value : h) } : m));

  const handleSave = async () => {
    setSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const upserts = memberScores
        .filter(m => m.totalScore.trim() !== '' || m.holeScores.some(h => h !== ''))
        .map(m => ({
          round_id: roundId,
          member_id: m.memberId,
          total_score: m.totalScore ? parseInt(m.totalScore, 10) : null,
          hole_scores: m.holeScores,
          ...(m.existingScoreId ? { id: m.existingScoreId } : {}),
        }));

      if (upserts.length === 0) {
        showToast('No scores to save', 'info');
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('scores').upsert(upserts, { onConflict: 'id' });
      if (error) throw error;
      track('scores_saved', { roundId, count: upserts.length });
      showToast('Scores saved!', 'success');
      router.back();
    } catch (e) {
      captureException(e as Error, { screen: 'ScoreEntry', action: 'handleSave' });
      showToast('Failed to save scores', 'error');
    } finally {
      setSaving(false);
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

  if (error || !roundInfo) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <EmptyState
          title="Something went wrong"
          description={error ?? 'Could not load round'}
          icon="alert"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>{roundInfo.courseName}</Text>
            <Text style={{ fontSize: 13, color: c.textSecondary, marginTop: 2 }}>{roundInfo.roundDate}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setHoleByHole(h => !h)}
              style={{ padding: 8, borderRadius: 8, backgroundColor: c.surface }}
            >
              {holeByHole ? <List size={20} color={c.primary} /> : <Grid size={20} color={c.primary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={24} color={c.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {memberScores.map((ms, index) => (
            <Animated.View key={ms.memberId} entering={FadeInDown.delay(index * 50).duration(300)}>
              <ScorePlayerRow
                memberId={ms.memberId}
                displayName={ms.displayName}
                totalScore={ms.totalScore}
                holeScores={ms.holeScores}
                holeByHole={holeByHole}
                onTotalChange={(val) => updateScore(ms.memberId, val)}
                onHoleChange={(hole, val) => updateHoleScore(ms.memberId, hole, val)}
                colors={c}
              />
            </Animated.View>
          ))}
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: saving ? c.primaryMuted : c.primary, borderRadius: 14, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Save size={18} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save Scores'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
