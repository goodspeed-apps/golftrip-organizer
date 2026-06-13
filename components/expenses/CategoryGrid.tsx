import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

const CATEGORIES = [
  { id: 'green_fees', label: 'Green Fees', icon: '⛳', desc: 'Green fees' },
  { id: 'cart_rental', label: 'Cart Rental', icon: '🚗', desc: 'Cart rental' },
  { id: 'lodging', label: 'Lodging', icon: '🏨', desc: 'Lodging' },
  { id: 'meals', label: 'Meals', icon: '🍔', desc: 'Meals & drinks' },
  { id: 'side_bets', label: 'Side Bets', icon: '🎰', desc: 'Side bets payout' },
  { id: 'tips', label: 'Tips', icon: '💰', desc: 'Tip' },
  { id: 'misc', label: 'Misc', icon: '📦', desc: 'Miscellaneous' },
];

interface Props {
  selected: string;
  onSelect: (id: string, descSuggestion: string) => void;
}

function CategoryItem({ cat, selected, onSelect, index }: { cat: typeof CATEGORIES[0]; selected: boolean; onSelect: Props['onSelect']; index: number }) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(250)} style={[animStyle, { width: '25%', alignItems: 'center', marginBottom: 12 }]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={() => onSelect(cat.id, cat.desc)}
        accessibilityLabel={cat.label}
        accessibilityHint={`Select ${cat.label} as expense category`}
        style={{
          width: 58, height: 58, borderRadius: 16, backgroundColor: selected ? colors.primaryMuted : colors.surface,
          alignItems: 'center', justifyContent: 'center', marginBottom: 4,
          borderWidth: 2, borderColor: selected ? colors.primary : colors.border,
        }}
      >
        <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
      </Pressable>
      <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: selected ? colors.primary : colors.textSecondary, textAlign: 'center' }}>{cat.label}</Text>
    </Animated.View>
  );
}

export function CategoryGrid({ selected, onSelect }: Props) {
  const colors = useThemeColors();
  return (
    <View>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginBottom: 10 }}>CATEGORY</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat, i) => (
          <CategoryItem key={cat.id} cat={cat} selected={selected === cat.id} onSelect={onSelect} index={i} />
        ))}
      </View>
    </View>
  );
}
