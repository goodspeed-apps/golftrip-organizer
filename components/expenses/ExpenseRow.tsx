import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Receipt, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  paid_by_name: string;
  paid_by_id: string;
  created_at: string;
  split_count: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  tee_fees: '⛳',
  accommodation: '🏨',
  food: '🍔',
  transport: '🚗',
  drinks: '🍺',
  equipment: '🏌️',
  other: '💳',
};

interface ExpenseRowProps {
  expense: Expense;
  currentUserId: string;
  index?: number;
  onPress?: () => void;
}

export function ExpenseRow({ expense, currentUserId, index = 0, onPress }: ExpenseRowProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isMyExpense = expense.paid_by_id === currentUserId;
  const perPerson = (expense.amount ?? 0) / Math.max(expense.split_count, 1);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const emoji = CATEGORY_EMOJI[expense.category] ?? '💳';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()} style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        accessibilityLabel={`Expense: ${expense.description}, $${(expense.amount ?? 0).toFixed(2)}`}
        accessibilityHint="View expense details"
        accessibilityRole="button"
        style={[
          styles.row,
          { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>

        <View style={styles.info}>
          <Text style={[styles.desc, { color: colors.text }]} numberOfLines={1}>
            {expense.description}
          </Text>
          <Text style={[styles.paidBy, { color: colors.textSecondary }]}>
            {isMyExpense ? "You paid" : `${expense.paid_by_name} paid`} · {formatDate(expense.created_at)}
          </Text>
          <Text style={[styles.split, { color: colors.textMuted }]}>
            ${perPerson.toFixed(2)} per person · {expense.split_count} splitting
          </Text>
        </View>

        <View style={styles.amountCol}>
          <Text style={[styles.amount, { color: isMyExpense ? colors.success : colors.text }]}>
            ${(expense.amount ?? 0).toFixed(2)}
          </Text>
          {isMyExpense && (
            <View style={[styles.owedBadge, { backgroundColor: colors.positiveMuted }]}>
              <Text style={[styles.owedText, { color: colors.positive }]}>paid</Text>
            </View>
          )}
        </View>

        <ChevronRight size={16} color={colors.border} style={{ marginLeft: 4 }} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 72,
    gap: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  desc: {
    fontSize: 15,
    fontWeight: '700',
  },
  paidBy: {
    fontSize: 12,
  },
  split: {
    fontSize: 11,
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
  },
  owedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  owedText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
