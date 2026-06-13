import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput,
  Switch, ActivityIndicator, Platform, KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X, Trophy } from 'lucide-react-native';
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

type Member = { id: string; display_name: string; guest_name?: string };
type ScoreMap = Record<string, { total: string; holes: string[] }>;

const EMPTY_HOLES = Array(18).fill('');

export default function ScoreEntryModal() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { round_id, trip_id, course_name, round_date } = useLocalSearchParams<{
    round_id: string; trip_id: string; course_name: string; round_date: string;
  }>();

  const [members, setMembers] = useState<Member[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [holeMode, setHoleMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    track('screen_view_score_entry', { round_id, trip_id });
    fetchMembers();
  }, [round_id, trip_id]);

  const fetchMembers = useCallback(async () => {
    if (!trip_id) { setLoading(false); return; }
    try {
      const end = trackApiLatency('fetch_trip_members');
      const { data, error } = await supabase
        .from('trip_members')
        .select('id, guest_name, users(display_name)')
        .eq('trip_id', trip_id)
        .eq('rsvp_status', 'accepted');
      end();
      if (error) throw error;
      const parsed: Member[] = (data ?? []).map((m: any) => ({
        id: m.id,
        display_name: m.users?.display_name ?? m.guest_name ?? 'Guest',
        guest_name: m.guest_name,
      }));
      setMembers(parsed);
      const initial: ScoreMap = {};
      parsed.forEach(m => { initial[m.id] = { total: '', holes: [...EMPTY_HOLES] }; });
      setScores(initial);
      trackScreenLoad('score_entry', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'score_entry', action: 'fetch_members' });
    } finally {
      setLoading(false);
    }
  }, [trip_id]);

  const updateTotal = (memberId: string, val: string) =>
    setScores(s => ({ ...s, [memberId]: { ...s[memberId], total: val } }));

  const saveScores = async () => {
    if (!round_id || !user?.id) return;
    setSaving(true);
    track('save_all_scores', { round_id, member_count: members.length });
    try {
      const end = trackApiLatency('upsert_scores');
      const rows = members
        .filter(m => scores[m.id]?.total)
        .map(m => ({
          round_id, trip_id, member_id: m.id,
          total_score: parseInt(scores[m.id].total, 10),
          hole_scores: holeMode ? scores[m.id].holes.map(Number) : null,
          created_by: user.id,
        }));
      const { error } = await supabase.from('scores').upsert(rows, { onConflict: 'round_id,member_id' });
      end();
      if (error) throw error;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: 'Scores saved!', type: 'success' });
      router.dismiss();
    } catch (e) {
      captureException(e as Error, { screen: 'score_entry', action: 'save_scores' });
      showToast({ message: 'Failed to save scores', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const styles = makeStyles(colors);
  const hasAnyScore = members.some(m => !!scores[m.id]?.total);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View entering={FadeInDown.duration(300)} style={{ flex: 1 }}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>{course_name ?? 'Score Entry'}</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>{round_date ?? ''}</Text>
            </View>
            <Pressable onPress={() => router.dismiss()} accessibilityLabel="Close" accessibilityHint="Dismiss score entry" style={styles.closeBtn}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Hole-by-hole</Text>
            <Switch value={holeMode} onValueChange={setHoleMode} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.background} />
          </View>

          {loading ? (
            <LoadingSkeleton variant="list" count={4} />
          ) : members.length === 0 ? (
            <EmptyState icon={<Trophy size={40} color={colors.primary} />} title="No players found" subtitle="Add members to the trip first" />
          ) : (
            <FlatList
              data={members}
              keyExtractor={m => m.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(index * 50).duration(250)}>
                  <ScorePlayerRow
                    member={item}
                    scoreEntry={scores[item.id] ?? { total: '', holes: [...EMPTY_HOLES] }}
                    holeMode={holeMode}
                    onTotalChange={val => updateTotal(item.id, val)}
                  />
                </Animated.View>
              )}
            />
          )}

          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Pressable
              onPress={saveScores}
              disabled={saving || !hasAnyScore}
              accessibilityLabel="Save all scores"
              accessibilityHint="Saves entered scores and updates leaderboard"
              style={[styles.saveBtn, { backgroundColor: hasAnyScore ? colors.primary : colors.border }]}
            >
              {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : (
                <Text style={[styles.saveBtnText, { color: colors.textOnPrimary }]}>Save All Scores</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  toggleLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
});
