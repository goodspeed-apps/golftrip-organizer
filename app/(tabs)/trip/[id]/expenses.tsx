import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { DollarSign, Plus, ArrowRightLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ExpenseRow } from '@/components/expenses/ExpenseRow';
import { SettlementSummary } from '@/components/expenses/SettlementSummary';
import { Spacing, BorderRadius } from '@/lib/theme';

const spacing = Spacing;
const radii = BorderRadius;

interface Expense {
  id: string;
  description: string;
  category: string;
  amount_cents: number;
  paid_by_member_id: string;
  split_type: string;
  split_member_ids: string[];
  expense_date: string;
  is_settled: boolean;
}

interface Member {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  display_name?: string;
}

export default function ExpensesScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    const start = Date.now();
    try {
      setError(null);
      const endApi = trackApiLatency('fetch_expenses');
      const [expRes, memRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('trip_id', id).order('expense_date', { ascending: false }),
        supabase.from('trip_members').select('id, user_id, guest_name').eq('trip_id', id),
      ]);
      endApi();
      if (expRes.error) throw expRes.error;
      if (memRes.error) throw memRes.error;
      setExpenses(expRes.data ?? []);
      setMembers(memRes.data ?? []);
      trackScreenLoad('expenses', start);
    } catch (err) {
      captureException(err as Error, { screen: 'expenses', action: 'fetchData' });
      setError("Couldn't load expenses. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    track('screen_view_expenses', { trip_id: id });
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const totalCents = expenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
  const myMember = members.find((m) => m.user_id === user?.id);
  const myShare = myMember
    ? expenses
        .filter((e) => e.split_member_ids?.includes(myMember.id))
        .reduce((s, e) => {
          const count = (e.split_member_ids ?? []).length || 1;
          return s + Math.round((e.amount_cents ?? 0) / count);
        }, 0)
    : 0;

  const handleAddExpense = () => {
    track('tap_add_expense', { trip_id: id });
    router.push(`/(modal)/add-expense?tripId=${id}` as never);
  };

  const handleSettle = () => {
    track('tap_settle_up', { trip_id: id });
    router.push(`/(modal)/settlements?tripId=${id}` as never);
  };

  const SummaryHeader = () => (
    <View>
      <Animated.View entering={FadeInDown.delay(0).duration(350)}>
        <View style={{ margin: spacing.md, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg }}>
          <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Trip Total
          </Text>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 36, color: colors.text, marginTop: spacing.xs }}>
            ${((totalCents ?? 0) / 100).toFixed(2)}
          </Text>
          <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs }}>
            {"Your share: "}
            <Text style={{ fontFamily: 'Manrope_600SemiBold', color: colors.primary }}>
              ${((myShare ?? 0) / 100).toFixed(2)}
            </Text>
          </Text>
          <Pressable
            onPress={handleSettle}
            accessibilityLabel="Settle up"
            accessibilityHint="View and settle outstanding balances"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              marginTop: spacing.md,
              backgroundColor: colors.primaryMuted,
              borderRadius: 999,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              alignSelf: 'flex-start',
            }}
          >
            <ArrowRightLeft size={14} color={colors.primary} />
            <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.primary }}>
              Settle Up
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {loading && (
        <View style={{ paddingHorizontal: spacing.md }}>
          <LoadingSkeleton variant="list-item" />
          <LoadingSkeleton variant="list-item" />
          <LoadingSkeleton variant="list-item" />
        </View>
      )}

      {error && !loading && (
        <View style={{ margin: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.xl }}>
          <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.error, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={fetchData} style={{ marginTop: spacing.sm, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Manrope_600SemiBold', color: colors.primary }}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && expenses.length > 0 && (
        <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.md, marginBottom: spacing.sm, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          All Expenses
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 22, color: colors.text }}>Expenses</Text>
      </View>

      <FlatList
        data={loading || error ? [] : expenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={SummaryHeader}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index).duration(350)}>
            <ExpenseRow
              expense={item}
              members={members}
              onPress={() => {
                track('tap_expense_row', { expense_id: item.id });
              }}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState
              icon={<DollarSign size={40} color={colors.primary} />}
              title="No expenses yet"
              description={"Add your first expense and we'll handle the math. No awkward money convos needed!"}
              action={{ label: 'Add Expense', onPress: handleAddExpense }}
            />
          ) : null
        }
        ListFooterComponent={<View style={{ height: 80 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        onPress={handleAddExpense}
        accessibilityLabel="Add an expense"
        accessibilityHint="Opens the add expense form"
        style={{
          position: 'absolute',
          bottom: spacing.xl,
          right: spacing.lg,
          backgroundColor: colors.primary,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Plus size={24} color={colors.textOnPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}
