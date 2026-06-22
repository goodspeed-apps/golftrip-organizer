import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Minus, Plus } from 'lucide-react-native';

type MemberScore = {
  memberId: string;
  displayName: string;
  totalScore: string;
  holeScores: string[];
};

type Props = {
  member: MemberScore;
  holeByHole: boolean;
  onTotalChange: (v: string) => void;
  onHoleChange: (hole: number, v: string) => void;
  colors: Record<string, string>;
};

export function ScorePlayerRow({ member, holeByHole, onTotalChange, onHoleChange, colors }: Props) {
  const [focused, setFocused] = useState(false);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const adjust = (delta: number) => {
    scale.value = withSpring(0.95, {}, () => { scale.value = withSpring(1); });
    const current = parseInt(member.totalScore || '0', 10);
    const next = Math.max(0, current + delta);
    onTotalChange(next.toString());
  };

  return (
    <View style={{ marginBottom: 12, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: focused ? colors.primary : colors.border }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text, marginBottom: 10 }}>{member.displayName}</Text>
      {!holeByHole ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => adjust(-1)} accessibilityLabel="Decrease score" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
            <Minus size={18} color={colors.text} />
          </Pressable>
          <Animated.View style={animStyle}>
            <TextInput
              value={member.totalScore}
              onChangeText={onTotalChange}
              keyboardType="numeric"
              placeholder="--"
              placeholderTextColor={colors.textSecondary}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel={`Score for ${member.displayName}`}
              style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, color: colors.text, textAlign: 'center', minWidth: 80, borderBottomWidth: 2, borderBottomColor: focused ? colors.primary : colors.border, paddingBottom: 4 }}
            />
          </Animated.View>
          <Pressable onPress={() => adjust(1)} accessibilityLabel="Increase score" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={18} color={colors.text} />
          </Pressable>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Array.from({ length: 18 }, (_, i) => (
              <View key={i} style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.textSecondary, marginBottom: 4 }}>{i + 1}</Text>
                <TextInput
                  value={member.holeScores[i] ?? ''}
                  onChangeText={(v) => onHoleChange(i, v)}
                  keyboardType="numeric"
                  placeholder="-"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel={`Hole ${i + 1} score for ${member.displayName}`}
                  style={{ width: 36, height: 40, textAlign: 'center', fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.text, backgroundColor: colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
