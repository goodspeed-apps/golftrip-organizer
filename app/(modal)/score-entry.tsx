import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Switch,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { X, CheckCircle, Golf } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { PlayerScoreRow } from '@/components/PlayerScoreRow';

type Member = { id: string; display_name: string | null; guest_name: string | null };
type ScoreMap = Record<string, string>;

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holeMode, setHoleMode] = useState(false);
  const [holeScores, setHoleScores] = useState<Record<string, string[]>>({});
  const startTime = useRef(Date.now());

  useEffect(() => {
    track('screen_view_score_entry', { round_id, trip_id });
    fetchMembers();
  }, [trip_id]);

  const fetchMembers = useCallback(async () => {
    if (!trip_id) { setLoading(false); return; }
    const end = trackApiLatency('fetch_members');
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select('id, guest_name, users(display_name)')
        .eq('trip_id', trip_id)
        .eq('rsvp_status', 'accepted');
      if (error) throw error;
      const mapped: Member[] = (data ?? []).map((m: any) => ({
        id: m.id,
        display_name: m.users?.display_name ?? null,
        guest_name: m.guest_name ?? null,
      }));
      setMembers(mapped);
      trackScreenLoad('ScoreEntry', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'ScoreEntry', action: 'fetchMembers' });
      showToast({ message: 'Failed to load players', type: 'error' });
    } finally {
      setLoading(false);
      end();
    }
  }, [trip_id]);

  const handleSave = async () => {
    if (!round_id || !trip_id || !user?.id) return;
    setSaving(true);
    track('score_entry_save', { round_id, count: members.length });
    const end = trackApiLatency('save_scores');
    try {
      const upserts = members
        .filter(m => scores[m.id]?.trim())
        .map(m => ({
          round_id, trip_id, member_id: m.id,
          total_score: parseInt(scores[m.id] ?? '0', 10),
          hole_scores: holeMode ? (holeScores[m.id] ?? []).map(h => parseInt(h || '0', 10)) : null,
          created_by: user.id,
        }));
      if (!upserts.length) { showToast({ message: 'Enter at least one score', type: 'error' }); setSaving(false); return; }
      const { error } = await supabase.from('scores').upsert(upserts, { onConflict: 'round_id,member_id' });
      if (error) throw error;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: 'Scores saved!', type: 'success' });
      router.dismiss();
    } catch (e) {
      captureException(e as Error, { screen: 'ScoreEntry', action: 'saveScores' });
      showToast({ message: 'Failed to save scores', type: 'error' });
    } finally {
      setSaving(false);
      end();
    }
  };

  const completedCount = members.filter(m => scores[m.id]?.trim()).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: colors.text }} numberOfLines={1}>
              {course_name ?? 'Score Entry'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              {round_date ?? ''}
            </Text>
          </View>
          <Pressable onPress={() => router.dismiss()} style={{ padding: 8 }}
            accessibilityLabel="Close score entry" accessibilityHint="Dismisses the score entry modal">
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
          backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text, flex: 1 }}>Hole-by-hole</Text>
          <Switch value={holeMode} onValueChange={setHoleMode} thumbColor={colors.surface}
            trackColor={{ false: colors.border, true: colors.primary }} />
        </View>

        {loading ? (
          <LoadingSkeleton variant="list" />
        ) : members.length === 0 ? (
          <EmptyState icon="users" title="No players found" description="Add members to the trip first" />
        ) : (
          <FlatList
            data={members}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshing={false}
            onRefresh={fetchMembers}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 50)}>
                <PlayerScoreRow
                  member={item}
                  score={scores[item.id] ?? ''}
                  onScoreChange={val => setScores(prev => ({ ...prev, [item.id]: val }))}
                  holeMode={holeMode}
                  holeScores={holeScores[item.id] ?? Array(18).fill('')}
                  onHoleChange={(holeIdx, val) =>
                    setHoleScores(prev => {
                      const arr = [...(prev[item.id] ?? Array(18).fill(''))];
                      arr[holeIdx] = val;
                      const total = arr.reduce((s, v) => s + (parseInt(v || '0', 10)), 0);
                      setScores(sp => ({ ...sp, [item.id]: total > 0 ? String(total) : '' }));
                      return { ...prev, [item.id]: arr };
                    })
                  }
                />
              </Animated.View>
            )}
          />
        )}

        {/* Save Button */}
        {!loading && members.length > 0 && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
            paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.background,
            borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => ({
                backgroundColor: completedCount > 0 ? colors.primary : colors.border,
                borderRadius: 14, paddingVertical: 16, alignItems: 'center',
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
              accessibilityLabel={`Save all scores, ${completedCount} of ${members.length} entered`}
              accessibilityHint="Saves scores and updates the leaderboard"
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.textOnPrimary }}>
                  {completedCount > 0 ? `Save Scores (${completedCount}/${members.length})` : 'Save All Scores'}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
