import React from 'react';
import { ScrollView, Pressable, Text } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';

interface Props { categories: string[]; active: string; onSelect: (cat: string) => void; }

export function ExpenseCategoryChips({ categories, active, onSelect }: Props) {
  const colors = useThemeColors();
  const { track } = useAnalytics();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
      {categories.map(cat => {
        const isActive = cat === active;
        return (
          <Pressable
            key={cat}
            onPress={() => { track('filter_expenses_category', { category: cat }); onSelect(cat); }}
            accessibilityLabel={`Filter by ${cat}`}
            accessibilityHint={`Shows only ${cat} expenses`}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isActive ? colors.primary : colors.surface, borderWidth: 1, borderColor: isActive ? colors.primary : colors.border, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: isActive ? colors.textOnPrimary : colors.textSecondary }}>{cat}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
