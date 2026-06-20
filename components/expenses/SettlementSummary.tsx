import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { CheckCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface SettlementDebt {
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  amount: number;
}

export interface SettlementSummaryProps {
  debts: SettlementDebt[];
  totalExpenses: number;
  memberCount: number;
  currentUserId: string;
  onMarkSettled?: (debt: SettlementDebt) => void;
}

export function SettlementSummary({
  debts,
  totalExpenses,
  memberCount,
  currentUserId,
  onMarkSettled,
}: SettlementSummaryProps) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(true);
  const toggleScale = useSharedValue(1);
  const toggleAnim = useAnimatedStyle(() => ({ transform: [{ scale: toggleScale.value }] }));

  const perPerson = memberCount > 0 ? (totalExpenses ?? 0) / memberCount : 0;
  const myDebts = debts.filter((d) => d.from_user_id === currentUserId);
  const owedToMe = debts.filter((d) => d.to_user_id === currentUserId);

  return (
    <Animated.View
      entering={FadeInDown.delay(30).springify()}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
    >
      {/* Summary stats */}
      <View style={[styles.statsRow, { borderBottomColor: colors.divider }]}>
        <StatBox
          label="Total spent"
          value={`$${(totalExpenses ?? 0).toFixed(2)}`}
          valueColor={colors.text}
          colors={colors}
        />
        <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
        <StatBox
          label="Per person"
          value={`$${perPerson.toFixed(2)}`}
          valueColor={colors.primary}
          colors={colors}
        />
        <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
        <StatBox
          label="Expenses"
          value={`${memberCount}`}
          valueColor={colors.secondary}
          colors={colors}
        />
      </View>

      {/* Settle up header */}
      <Animated.View style={toggleAnim}>
        <Pressable
          onPress={() => {
            toggleScale.value = withSpring(0.97, {}, () => { toggleScale.value = withSpring(1); });
            setExpanded((v) => !v);
          }}
          onPressIn={() => { toggleScale.value = withSpring(0.97); }}
          onPressOut={() => { toggleScale.value = withSpring(1); }}
          accessibilityLabel={expanded ? "Collapse settlement details" : "Expand settlement details"}
          accessibilityRole="button"
          style={styles.settleHeader}
        >
          <Text style={[styles.settleTitle, { color: colors.text }]}>💸 Settle Up</Text>
          {expanded
            ? <ChevronUp size={18} color={colors.textSecondary} />
            : <ChevronDown size={18} color={colors.textSecondary} />}
        </Pressable>
      </Animated.View>

      {expanded && (
        <View style={styles.debtsContainer}>
          {debts.length === 0 && (
            <View style={styles.allSettled}>
              <CheckCircle size={24} color={colors.success} />
              <Text style={[styles.allSettledText, { color: colors.success }]}>
                All squared up! 🎉
              </Text>
            </View>
          )}

          {myDebts.map((debt, i) => (
            <DebtRow
              key={`${debt.from_user_id}-${debt.to_user_id}`}
              debt={debt}
              isMyDebt
              index={i}
              colors={colors}
              onSettle={() => onMarkSettled?.(debt)}
            />
          ))}

          {owedToMe.map((debt, i) => (
            <DebtRow
              key={`${debt.from_user_id}-${debt.to_user_id}-owed`}
              debt={debt}
              isMyDebt={false}
              index={i + myDebts.length}
              colors={colors}
              onSettle={undefined}
            />
          ))}

          {debts
            .filter((d) => d.from_user_id !== currentUserId && d.to_user_id !== currentUserId)
            .map((debt, i) => (
              <DebtRow
                key={`${debt.from_user_id}-${debt.to_user_id}-other`}
                debt={debt}
                isMyDebt={false}
                index={i + myDebts.length + owedToMe.length}
                colors={colors}
                onSettle={undefined}
              />
            ))}
        </View>
      )}
    </Animated.View>
  );
}

function StatBox({
  label,
  value,
  valueColor,
  colors,
}: {
  label: string;
  value: string;
  valueColor: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function DebtRow({
  debt,
  isMyDebt,
  index,
  colors,
  onSettle,
}: {
  debt: SettlementDebt;
  isMyDebt: boolean;
  index: number;
  colors: ReturnType<typeof useThemeColors>;
  onSettle?: () => void;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).springify()}
      style={[
        styles.debtRow,
        {
          backgroundColor: isMyDebt ? colors.warningMuted : colors.surfaceSecondary,
          borderColor: isMyDebt ? colors.warning : colors.border,
        },
      ]}
    >
      <View style={styles.debtNames}>
        <Text style={[styles.debtName, { color: isMyDebt ? colors.warning : colors.text }]}>
          {debt.from_name}
        </Text>
        <ArrowRight size={13} color={isMyDebt ? colors.warning : colors.textMuted} />
        <Text style={[styles.debtName, { color: colors.text }]}>{debt.to_name}</Text>
      </View>

      <View style={styles.debtRight}>
        <Text style={[styles.debtAmount, { color: isMyDebt ? colors.warning : colors.text }]}>
          ${(debt.amount ?? 0).toFixed(2)}
        </Text>
        {isMyDebt && onSettle && (
          <Animated.View style={anim}>
            <Pressable
              onPress={onSettle}
              onPressIn={() => { scale.value = withSpring(0.92); }}
              onPressOut={() => { scale.value = withSpring(1); }}
              accessibilityLabel={`Mark debt to ${debt.to_name} as settled`}
              accessibilityRole="button"
              style={[styles.settleBtn, { backgroundColor: colors.success }]}
            >
              <CheckCircle size={12} color={colors.textOnPrimary} />
              <Text style={[styles.settleBtnText, { color: colors.textOnPrimary }]}>Settle</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  settleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  settleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  debtsContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  allSettled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  allSettledText: {
    fontSize: 15,
    fontWeight: '700',
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
  },
  debtNames: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  debtName: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 90,
  },
  debtRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  debtAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 32,
  },
  settleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
