import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

type Category = { key: string; label: string; emoji: string; suggestion: string };

const CATEGORIES: Category[] = [
  { key: 'green_fees', label: 'Green Fees', emoji: '⛳', suggestion: 'Green fees' },
  { key: 'cart_rental', label: 'Cart Rental', emoji: '🛺', suggestion: 'Cart rental' },
  { key: 'lodging', label: 'Lodging', emoji: '🏨', suggestion: 'Hotel / lodging' },
  { key: 'meals', label: 'Meals', emoji: '🍔', suggestion: 'Dinner / meals' },
  { key: 'side_bets', label: 'Side Bets', emoji: '🏆', suggestion: 'Side bet payout' },
  { key: 'tips', label: 'Tips', emoji: '💵', suggestion: 'Caddie / staff tips' },
  { key: 'misc', label: 'Misc', emoji: '📦', suggestion: 'Miscellaneous expense' },
];

type Colors = Record<string, string>;

interface Props { selected: string; onSelect: (key: string, suggestion: string) => void; colors: Colors; }

function CategoryItem({ cat, selected, onSelect, colors }: { cat: Category; selected: boolean; onSelect: (key: string, suggestion: string) => void; colors: Colors }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={() => { scale.value = withSpring(0.88, {}, () => { scale.value = withSpring(1); }); onSelect(cat.key, cat.suggestion); }}
      accessibilityLabel={cat.label}
      accessibilityHint={`Select ${cat.label} as expense category`}
      style={{ width: '13%', alignItems: 'center', marginHorizontal: '1%' }}
    >
      <Animated.View style={[animStyle, { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.primaryMuted : colors.surface, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.border, marginBottom: 6 }]}>
        <Text style={{ fontSize: 24 }}>{cat.emoji}</Text>
      </Animated.View>
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: selected ? colors.accent : colors.textSecondary, textAlign: 'center' }}>{cat.label}</Text>
    </Pressable>
  );
}

export function ExpenseCategoryGrid({ selected, onSelect, colors }: Props) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      {CATEGORIES.map(cat => (
        <CategoryItem key={cat.key} cat={cat} selected={selected === cat.key} onSelect={onSelect} colors={colors} />
      ))}
    </View>
  );
}
