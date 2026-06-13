import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ChevronDown, ChevronUp, Medal } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type Standing = {
  member_id: string;
  display_name: string;
  total_score: number;
  best_round: number | null;
  rounds_played: number;
};

type Props = { standing: Standing; rank: number; isExpanded: boolean; onPress: () => void };

export function LeaderboardRow({ standing, rank, isExpanded, onPress }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rankColor = rank === 1 ? colors.warning : rank === 2 ? colors.textSecondary : rank === 3 ? colors.accent : colors.textMuted;

  return (
    <Animated.View style={[animStyle, { marginHorizontal: 16, marginBottom: 8 }]}>
      <Pressable onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        accessibilityLabel={`${standing.display_name} rank ${rank}`}
        accessibilityHint="Tap to expand per-round breakdown"
        style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: rank === 1 ? colors.warning : colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: rankColor, width: 24, textAlign: 'center' }}>{rank}</Text>
          {rank === 1 && <Medal size={16} color={colors.warning} />}
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{standing.display_name}</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>{standing.total_score}</Text>
          {isExpanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
        </View>
        {isExpanded && (
          <Animated.View entering={FadeInDown.duration(250)} style={{ marginTop: 10, flexDirection: 'row', gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Best Round</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.success }}>{(standing.best_round ?? 0)}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Rounds</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{standing.rounds_played}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Avg / Round</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{standing.rounds_played > 0 ? (standing.total_score / standing.rounds_played).toFixed(1) : '--'}</Text>
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}
