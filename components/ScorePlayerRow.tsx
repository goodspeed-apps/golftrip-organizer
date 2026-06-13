import React, { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Minus, Plus } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type Member = { id: string; display_name: string; guest_name?: string };
type ScoreEntry = { total: string; holes: string[] };

interface Props {
  member: Member;
  scoreEntry: ScoreEntry;
  holeMode: boolean;
  onTotalChange: (val: string) => void;
}

export function ScorePlayerRow({ member, scoreEntry, holeMode, onTotalChange }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const increment = () => {
    scale.value = withSpring(0.97, { damping: 15 }, () => { scale.value = withSpring(1); });
    const cur = parseInt(scoreEntry.total || '0', 10);
    onTotalChange(String(cur + 1));
  };
  const decrement = () => {
    scale.value = withSpring(0.97, { damping: 15 }, () => { scale.value = withSpring(1); });
    const cur = parseInt(scoreEntry.total || '0', 10);
    if (cur > 0) onTotalChange(String(cur - 1));
  };

  const styles = makeStyles(colors);
  const initials = member.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Animated.View style={[styles.row, animStyle, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.primaryMuted }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{member.display_name}</Text>
      {!holeMode ? (
        <View style={styles.stepper}>
          <Pressable onPress={decrement} accessibilityLabel="Decrease score" style={[styles.stepBtn, { backgroundColor: colors.surface }]}>
            <Minus size={16} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            value={scoreEntry.total}
            onChangeText={onTotalChange}
            keyboardType="number-pad"
            placeholder="--"
            placeholderTextColor={colors.textMuted}
            style={[styles.scoreInput, { color: colors.text, borderColor: scoreEntry.total ? colors.primary : colors.border, backgroundColor: colors.surface }]}
            accessibilityLabel={`Score for ${member.display_name}`}
            maxLength={3}
          />
          <Pressable onPress={increment} accessibilityLabel="Increase score" style={[styles.stepBtn, { backgroundColor: colors.surface }]}>
            <Plus size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.holeHint, { color: colors.textMuted }]}>
          {scoreEntry.holes.filter(Boolean).length}/18 holes
        </Text>
      )}
    </Animated.View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 6, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  name: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  scoreInput: { width: 56, height: 44, textAlign: 'center', fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', borderWidth: 2, borderRadius: 10 },
  holeHint: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
