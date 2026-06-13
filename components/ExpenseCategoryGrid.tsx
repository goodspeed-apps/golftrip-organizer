import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { Flag, Car, Home, Utensils, Coins, Heart, MoreHorizontal } from 'lucide-react-native';

const CATEGORIES = [
  { id: 'green_fees', label: 'Green Fees', icon: Flag, suggestion: 'Green fees' },
  { id: 'cart_rental', label: 'Cart Rental', icon: Car, suggestion: 'Cart rental' },
  { id: 'lodging', label: 'Lodging', icon: Home, suggestion: 'Hotel / lodging' },
  { id: 'meals', label: 'Meals', icon: Utensils, suggestion: 'Dinner / meals' },
  { id: 'side_bets', label: 'Side Bets', icon: Coins, suggestion: 'Side bet payout' },
  { id: 'tips', label: 'Tips', icon: Heart, suggestion: 'Caddie / staff tips' },
  { id: 'misc', label: 'Misc', icon: MoreHorizontal, suggestion: 'Miscellaneous expense' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

interface Props {
  selected: string;
  onSelect: (id: CategoryId, suggestion: string) => void;
}

export function ExpenseCategoryGrid({ selected, onSelect }: Props) {
  const colors = useThemeColors();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat.id;
        const Icon = cat.icon;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id, cat.suggestion)}
            accessibilityLabel={cat.label}
            accessibilityHint={`Select ${cat.label} as the expense category`}
            style={({ pressed }) => ({
              width: '13%',
              minWidth: 44,
              flex: 1,
              alignItems: 'center',
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: isSelected ? colors.accent : colors.border,
              backgroundColor: isSelected ? colors.secondaryMuted : colors.surface,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Icon
              size={22}
              color={isSelected ? colors.accent : colors.textSecondary}
              strokeWidth={isSelected ? 2.5 : 1.8}
            />
            <Text
              numberOfLines={1}
              style={{
                marginTop: 5,
                fontSize: 10,
                fontWeight: isSelected ? '700' : '500',
                color: isSelected ? colors.accent : colors.textSecondary,
                textAlign: 'center',
              }}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
