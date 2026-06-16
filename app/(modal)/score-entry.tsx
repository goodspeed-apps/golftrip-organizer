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
  const themeContext = useThemeColors();
  const colors = themeContext.colors;
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
    setMemberScores((prev) => prev.map((m) => m.memberId === memberId
      ? { ...m, holeScores: m.holeScores.map((h, i) => i === hole ? value : h) }
      : m
    ));

  const handleSave = async () => {
    setSaving(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const end = trackApiLatency('save_scores');
      const upserts = memberScores
        .filter((m) => m.totalScore !== '' || m.holeScores.some((h) => h !== ''))
        .map((m) => ({
          round_id: roundId,
          member_id: m.memberId,
          total_score: m.totalScore !== '' ? parseInt(m.totalScore, 10) : null,
          hole_scores: m.holeScores,
          ...(m.existingScoreId ? { id: m.existingScoreId } : {}),
        }));

      if (upserts.length === 0) {
        showToast('No scores to save', 'info');
        setSaving(false);
        return;
      }

      const { error: upsertErr } = await supabase.from('scores').upsert(upserts, { onConflict: 'id' });
      end();
      if (upsertErr) throw upsertErr;
      track('scores_saved', { roundId, count: upserts.length });
      showToast('Scores saved!', 'success');
      router.back();
    } catch (e) {
      captureException(e as Error, { screen: 'ScoreEntry', action: 'handleSave' });
      showToast('Could not save scores. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState icon={null} title="Error" subtitle={error} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: 'Manrope_700Bold' }}>Score Entry</Text>
            {roundInfo && (
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'Manrope_400Regular' }}>
                {roundInfo.courseName} · {roundInfo.roundDate}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setHoleByHole(!holeByHole)} style={{ padding: 8 }}>
              {holeByHole ? <List size={20} color={colors.primary} /> : <Grid size={20} color={colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {memberScores.map((ms, idx) => (
            <Animated.View key={ms.memberId} entering={FadeInDown.delay(idx * 40).duration(300)}>
              <ScorePlayerRow
                memberScore={ms}
                holeByHole={holeByHole}
                onScoreChange={(value: string) => updateScore(ms.memberId, value)}
                onHoleScoreChange={(hole: number, value: string) => updateHoleScore(ms.memberId, hole, value)}
                colors={colors as Record<string, string>}
              />
            </Animated.View>
          ))}
        </ScrollView>

        {/* Save Button */}
        <View style={{ padding: 20 }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Save size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Manrope_700Bold' }}>Save Scores</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
