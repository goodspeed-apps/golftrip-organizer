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
  const { colors } = useThemeColors();
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
    setMemberScores((prev) => prev.map((m) => {
      if (m.memberId !== memberId) return m;
      const hs = [...m.holeScores]; hs[hole] = value; return { ...m, holeScores: hs };
    }));

  const saveAllScores = async () => {
    if (!roundId || !roundInfo) return;
    setSaving(true);
    track('save_scores', { round_id: roundId, player_count: memberScores.length });
    const end = trackApiLatency('save_scores');
    try {
      const upserts = memberScores.filter((m) => m.totalScore !== '').map((m) => ({
        id: m.existingScoreId,
        round_id: roundId,
        trip_id: roundInfo.tripId,
        member_id: m.memberId,
        total_score: parseInt(m.totalScore, 10),
        hole_scores: holeByHole ? m.holeScores : null,
        created_by: user?.id,
      }));
      const { error: sErr } = await supabase.from('scores').upsert(upserts, { onConflict: 'id' });
      if (sErr) throw sErr;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: 'Scores saved!', type: 'success' });
      router.dismiss();
    } catch (e) {
      captureException(e as Error, { screen: 'ScoreEntry', action: 'saveAllScores' });
      showToast({ message: 'Failed to save scores', type: 'error' });
    } finally {
      setSaving(false);
      end();
    }
  };

  const completedCount = memberScores.filter((m) => m.totalScore !== '').length;
  const isComplete = completedCount === memberScores.length && memberScores.length > 0;

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <LoadingSkeleton variant="list" />
    </SafeAreaView>
  );
  if (error) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState icon="alert-circle" title="Oops!" description={error} action={{ label: 'Retry', onPress: fetchRoundData }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text }}>{roundInfo?.courseName ?? 'Round'}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{roundInfo?.roundDate ?? ''}</Text>
          </View>
          <Pressable onPress={() => router.dismiss()} accessibilityLabel="Close" accessibilityHint="Dismiss score entry" hitSlop={8}
            style={{ padding: 8, borderRadius: 20, backgroundColor: colors.surfaceElevated }}>
            <X size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Toggle */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, marginVertical: 12, backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 4 }}>
          {[{ label: 'Total Score', icon: List, val: false }, { label: 'Hole by Hole', icon: Grid, val: true }].map(({ label, icon: Icon, val }) => (
            <Pressable key={label} onPress={() => { setHoleByHole(val); track('toggle_score_mode', { mode: val ? 'hole' : 'total' }); }}
              accessibilityLabel={label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: holeByHole === val ? colors.primary : 'transparent' }}>
              <Icon size={14} color={holeByHole === val ? colors.textOnPrimary : colors.textSecondary} />
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: holeByHole === val ? colors.textOnPrimary : colors.textSecondary, marginLeft: 6 }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Progress */}
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 }}>
          {completedCount} / {memberScores.length} scores entered
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {memberScores.map((ms) => (
            <ScorePlayerRow
              key={ms.memberId}
              member={ms}
              holeByHole={holeByHole}
              onUpdateScore={updateScore}
              onUpdateHoleScore={updateHoleScore}
            />
          ))}
        </ScrollView>

        {/* Save button */}
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity
            onPress={saveAllScores}
            disabled={saving || !isComplete}
            accessibilityLabel="Save scores"
            style={{
              backgroundColor: isComplete ? colors.primary : colors.border,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Save size={18} color="#fff" />
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Save Scores</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
