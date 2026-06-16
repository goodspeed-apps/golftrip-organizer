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
  amount?: number;
  paid_by_name?: string;
  paid_by_id?: string;
  created_at?: string;
  split_count?: number;
}

interface Member {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  display_name?: string;
}

export default function ExpensesScreen() {
  const themeContext = useThemeColors();
  const colors = themeContext.colors;
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
        <View style={{ margin: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>Total Expenses</Text>
          <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text }}>
            ${(totalCents / 100).toFixed(2)}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            Your share: ${(myShare / 100).toFixed(2)}
          </Text>
        </View>
      </Animated.View>

      <SettlementSummary expenses={expenses} members={members} />

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.md }}>
        <Pressable
          onPress={handleAddExpense}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 12 }}
        >
          <Plus size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600' }}>Add Expense</Text>
        </Pressable>
        <Pressable
          onPress={handleSettle}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radii.md, paddingVertical: 12, borderWidth: 1, borderColor: colors.border }}
        >
          <ArrowRightLeft size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Settle Up</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={{ margin: spacing.md, padding: 12, backgroundColor: colors.error + '22', borderRadius: radii.md }}>
          <Text style={{ color: colors.error }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<SummaryHeader />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
            <ExpenseRow expense={item} members={members} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<DollarSign size={40} color={colors.textSecondary} />}
            title="No expenses yet"
            description="Add expenses to split costs with your group"
            action={{ label: 'Add Expense', onPress: handleAddExpense }}
          />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
