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
  const colorsContext = useThemeColors();
  const colors = colorsContext.colors ?? colorsContext;
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const upserts = memberScores
        .filter((m) => m.totalScore !== '' || m.holeScores.some((h) => h !== ''))
        .map((m) => ({
          id: m.existingScoreId,
          round_id: roundId,
          member_id: m.memberId,
          total_score: m.totalScore !== '' ? parseInt(m.totalScore, 10) : null,
          hole_scores: m.holeScores,
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

  const themeColors = colors as Record<string, string>;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <EmptyState title="Error" subtitle={error} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: themeColors.text }}>{roundInfo?.courseName ?? 'Score Entry'}</Text>
            <Text style={{ fontSize: 14, color: themeColors.textSecondary }}>{roundInfo?.roundDate}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setHoleByHole(!holeByHole)} style={{ padding: 8 }}>
              {holeByHole ? <List size={20} color={themeColors.primary} /> : <Grid size={20} color={themeColors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <X size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {memberScores.length === 0 ? (
          <EmptyState title="No Players" subtitle="No members found for this round." />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {memberScores.map((ms, idx) => (
              <Animated.View key={ms.memberId} entering={FadeInDown.delay(idx * 40).duration(300)}>
                <ScorePlayerRow
                  memberScore={ms}
                  holeByHole={holeByHole}
                  onUpdateScore={updateScore}
                  onUpdateHoleScore={updateHoleScore}
                  colors={themeColors}
                />
              </Animated.View>
            ))}
          </ScrollView>
        )}

        <View style={{ padding: 16 }}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: themeColors.primary,
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Save size={20} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save Scores'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
