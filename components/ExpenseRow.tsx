import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ChevronDown, ChevronUp, Utensils, Flag, Car, Home, Sword, HelpCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface Expense { id: string; category: string; description: string; amount_cents: number; paid_by_member_id: string; split_type: string; split_member_ids: string[]; expense_date: string; is_settled: boolean; }
interface TripMember { id: string; user_id: string; guest_name?: string; role: string; }
interface Props { expense: Expense; members: TripMember[]; }

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  'Green Fees': Flag, 'Cart': Car, 'Lodging': Home, 'Meals': Utensils, 'Side Bets': Sword,
};

export function ExpenseRow({ expense, members }: Props) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const paidBy = members.find(m => m.id === expense.paid_by_member_id);
  const paidByName = paidBy?.guest_name ?? 'Unknown';
  const Icon = CATEGORY_ICONS[expense.category] ?? HelpCircle;
  const splitCount = expense.split_type === 'all' ? members.length : (expense.split_member_ids?.length ?? 1);
  const perPerson = (expense.amount_cents ?? 0) / Math.max(splitCount, 1);

  return (
    <Animated.View style={[animStyle, { marginHorizontal: 16, marginVertical: 6, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.98); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={() => setExpanded(e => !e)}
        accessibilityLabel={`${expense.description}, $${((expense.amount_cents ?? 0) / 100).toFixed(2)}`}
        accessibilityHint="Tap to see split breakdown"
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, minHeight: 64 }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Icon size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text }} numberOfLines={1}>{expense.description}</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2 }}>Paid by {paidByName} · {expense.category}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>${((expense.amount_cents ?? 0) / 100).toFixed(2)}</Text>
          {expanded ? <ChevronUp size={14} color={colors.textSecondary} /> : <ChevronDown size={14} color={colors.textSecondary} />}
        </View>
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeInDown.duration(200)} style={{ paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 10, marginBottom: 6 }}>Split between {splitCount} {splitCount === 1 ? 'person' : 'people'} · ${(perPerson / 100).toFixed(2)} each</Text>
          {(expense.split_type === 'all' ? members : members.filter(m => expense.split_member_ids?.includes(m.id))).map(m => (
            <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.text }}>{m.guest_name ?? 'Member'}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>${(perPerson / 100).toFixed(2)}</Text>
            </View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}
