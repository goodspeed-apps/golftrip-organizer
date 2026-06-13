import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

type Member = { id: string; display_name: string | null; guest_name: string | null };

interface Props {
  member: Member;
  score: string;
  onScoreChange: (val: string) => void;
  holeMode: boolean;
  holeScores: string[];
  onHoleChange: (holeIdx: number, val: string) => void;
}

export function PlayerScoreRow({ member, score, onScoreChange, holeMode, holeScores, onHoleChange }: Props) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const displayName = member.display_name ?? member.guest_name ?? 'Player';

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, marginBottom: 10,
      borderWidth: 1, borderColor: focused ? colors.primary : colors.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryMuted,
          alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.primary }}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={{ flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text }}>
          {displayName}
        </Text>
        {!holeMode && (
          <Animated.View style={animStyle}>
            <TextInput
              value={score}
              onChangeText={onScoreChange}
              keyboardType="number-pad"
              placeholder="--"
              placeholderTextColor={colors.textMuted}
              onFocus={() => { setFocused(true); scale.value = withSpring(1.08); }}
              onBlur={() => { setFocused(false); scale.value = withSpring(1); }}
              style={{
                width: 64, height: 44, textAlign: 'center', borderRadius: 10,
                borderWidth: 2, borderColor: focused ? colors.primary : colors.border,
                backgroundColor: focused ? colors.primaryMuted : colors.surface,
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text,
              }}
              accessibilityLabel={`Score for ${displayName}`}
              accessibilityHint="Enter total score"
              maxLength={3}
            />
          </Animated.View>
        )}
        {holeMode && (
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.primary }}>
            {score || '--'}
          </Text>
        )}
      </View>
      {holeMode && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 6, flexDirection: 'row' }}>
          {Array.from({ length: 18 }, (_, i) => (
            <View key={i} style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.textSecondary, marginBottom: 2 }}>
                {i + 1}
              </Text>
              <TextInput
                value={holeScores[i] ?? ''}
                onChangeText={val => onHoleChange(i, val)}
                keyboardType="number-pad"
                placeholder="-"
                placeholderTextColor={colors.textMuted}
                style={{
                  width: 36, height: 36, textAlign: 'center', borderRadius: 8,
                  borderWidth: 1, borderColor: colors.border,
                  backgroundColor: colors.surface,
                  fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text,
                }}
                maxLength={2}
                accessibilityLabel={`Hole ${i + 1} score for ${displayName}`}
                accessibilityHint={`Enter score for hole ${i + 1}`}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
