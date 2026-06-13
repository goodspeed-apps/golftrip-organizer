import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface Standing {
  member_id: string;
  display_name: string;
  total_score: number;
  best_round: number | null;
  rounds_played: number;
  per_round: Record<string, number | null>;
}

interface RoundCard { id: string; course_name: string; round_date: string; is_complete: boolean; score_count: number; }

interface Props {
  standing: Standing;
  rank: number;
  expanded: boolean;
  rounds: RoundCard[];
  onPress: () => void;
}

export function LeaderboardRow({ standing, rank, expanded, rounds, onPress }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isWinner = rank === 1 && standing.rounds_played > 0;

  return (
    <Animated.View style={[animStyle, { marginHorizontal: 16, marginBottom: 6, borderRadius: 12, backgroundColor: isWinner ? colors.warningMuted : colors.card, borderWidth: 1, borderColor: isWinner ? colors.warning : colors.border, overflow: 'hidden' }]}>
      <Pressable onPress={onPress} onPressIn={() => { scale.value = withSpring(0.97); }} onPressOut={() => { scale.value = withSpring(1); }}
        accessibilityLabel={`${standing.display_name} rank ${rank}`} accessibilityHint="Tap to expand round breakdown"
        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
        <View style={{ width: 28, alignItems: 'center' }}>
          {isWinner ? <Trophy size={18} color={colors.warning} /> : <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.textSecondary }}>{rank}</Text>}
        </View>
        <Text style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text }}>{standing.display_name}</Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: isWinner ? colors.warning : colors.text }}>{standing.rounds_played > 0 ? standing.total_score : '-'}</Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>Best: {(standing.best_round ?? null) !== null ? standing.best_round : '-'}</Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textMuted, marginLeft: 4 }}>{standing.rounds_played}R</Text>
        {expanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
      </Pressable>
      {expanded && (
        <Animated.View entering={FadeInDown.duration(250)} style={{ paddingHorizontal: 14, paddingBottom: 10, gap: 4 }}>
          {rounds.map(r => (
            <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>{r.course_name}</Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.text }}>{standing.per_round[r.id] != null ? standing.per_round[r.id] : '-'}</Text>
            </View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}
