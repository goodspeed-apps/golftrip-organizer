import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface Standing {
  member_id: string;
  display_name: string;
  total_score: number;
  best_round: number | null;
  rounds_played: number;
  per_round: Record<string, number | null>;
}
interface RoundCard { id: string; course_name: string; round_date: string; is_complete: boolean; }

interface Props {
  standing: Standing;
  rank: number;
  expanded: boolean;
  rounds: RoundCard[];
  onToggle: () => void;
  isWinner: boolean;
}

export function LeaderboardRow({ standing, rank, expanded, rounds, onToggle, isWinner }: Props) {
  const colors = useThemeColors();
  return (
    <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      <Pressable onPress={onToggle} accessibilityLabel={`${standing.display_name} rank ${rank}`} accessibilityHint="Tap to expand per-round breakdown" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ width: 28, alignItems: 'center' }}>
          {isWinner ? <Trophy size={18} color={colors.warning} /> : <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary }}>{rank}</Text>}
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }} numberOfLines={1}>{standing.display_name}</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginRight: 4 }}>{standing.rounds_played}R</Text>
        <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: isWinner ? colors.warning : colors.text, minWidth: 36, textAlign: 'right' }}>{(standing.total_score ?? 0)}</Text>
        {expanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
      </Pressable>
      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.surfaceSecondary }}>
          {rounds.map(r => (
            <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{r.course_name}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{standing.per_round[r.id] != null ? (standing.per_round[r.id] ?? 0) : ', '}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Best round</Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.success }}>{standing.best_round != null ? (standing.best_round ?? 0) : ', '}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
