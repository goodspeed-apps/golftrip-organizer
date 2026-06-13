import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSpring } from 'react-native-reanimated';
import { ShoppingBag, MapPin, Home, Utensils, Crosshair, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {};
function CategoryIcon({ category, color }: { category: string; color: string }) {
  const size = 20;
  if (category === 'Green Fees') return <MapPin size={size} color={color} />;
  if (category === 'Cart') return <ShoppingBag size={size} color={color} />;
  if (category === 'Lodging') return <Home size={size} color={color} />;
  if (category === 'Meals') return <Utensils size={size} color={color} />;
  if (category === 'Side Bets') return <Crosshair size={size} color={color} />;
  return <HelpCircle size={size} color={color} />;
}

type TripMember = { id: string; user_id: string | null; guest_name: string | null; role: string; };
type Expense = { id: string; category: string; description: string; amount_cents: number; paid_by_member_id: string; split_member_ids: string[]; expense_date: string; is_settled: boolean; };
interface Props { expense: Expense; members: TripMember[]; index: number; expanded: boolean; onToggle: () => void; }

export function ExpenseRow({ expense, members, index, expanded, onToggle }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const payer = members.find(m => m.id === expense.paid_by_member_id);
  const payerName = payer?.guest_name ?? 'Unknown';
  const splitCount = (expense.split_member_ids ?? []).length;
  const perPerson = splitCount > 0 ? Math.round((expense.amount_cents ?? 0) / splitCount) : (expense.amount_cents ?? 0);
  const fmt = (cents: number) => `$${((cents ?? 0) / 100).toFixed(2)}`;

  return (
    <Animated.View entering={FadeInDown.delay(50 * index).duration(300)}>
      <Pressable onPress={onToggle}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        accessibilityLabel={`${expense.description}, ${fmt(expense.amount_cents)}`}
        accessibilityHint="Tap to see split details"
        style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 14, backgroundColor: colors.card,
          borderWidth: 1, borderColor: colors.border, padding: 14,
          shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
            <CategoryIcon category={expense.category} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 15 }} numberOfLines={1}>{expense.description}</Text>
            <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }}>
              Paid by {payerName} · {expense.category}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ color: colors.text, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 }}>{fmt(expense.amount_cents)}</Text>
            {expanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
          </View>
        </View>
        {expanded && (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, gap: 6 }}>
            <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>Split between {splitCount} people · {fmt(perPerson)} each</Text>
            {(expense.split_member_ids ?? []).map(mid => {
              const m = members.find(x => x.id === mid);
              return (
                <View key={mid} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{m?.guest_name ?? 'Member'}</Text>
                  <Text style={{ color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{fmt(perPerson)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
