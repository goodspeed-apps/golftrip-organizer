import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Plus, DollarSign, CheckCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';
import { ExpenseCategoryChips } from '@/components/ExpenseCategoryChips';
import { ExpenseRow } from '@/components/ExpenseRow';
import { SettlementCard } from '@/components/SettlementCard';

const CATEGORIES = ['All', 'Green Fees', 'Cart', 'Lodging', 'Meals', 'Side Bets', 'Misc'] as const;

type Expense = {
  id: string;
  description: string;
  amount_cents: number;
  category: string;
  split_member_ids?: string[];
  split_type?: string;
  expense_date?: string;
  paid_by_member_id?: string;
};

type Settlement = {
  id: string;
  from_member_id: string;
  to_member_id: string;
  amount_cents: number;
  settled: boolean;
};

type TripMember = {
  id: string;
  user_id: string;
  guest_name: string | null;
  role: string;
};

export default function ExpensesScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { isSubscribed } = useSubscription();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    const start = Date.now();
    try {
      const end = trackApiLatency('fetch_expenses');
      const [expRes, settleRes, memRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('trip_id', tripId).order('expense_date', { ascending: false }),
        supabase.from('expense_settlements').select('*').eq('trip_id', tripId),
        supabase.from('trip_members').select('id, user_id, guest_name, role').eq('trip_id', tripId),
      ]);
      end();
      if (expRes.error) throw expRes.error;
      if (settleRes.error) throw settleRes.error;
      if (memRes.error) throw memRes.error;
      setExpenses(expRes.data ?? []);
      setSettlements(settleRes.data ?? []);
      setMembers(memRes.data ?? []);
      setError(null);
      trackScreenLoad('expenses', start);
    } catch (err) {
      captureException(err, { screen: 'expenses', action: 'fetchData' });
      setError('Unable to load expenses. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    track('screen_view_expenses', { tripId });
    fetchData();
  }, [tripId]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const myMemberId = members.find(m => m.user_id === user?.id)?.id;
  const isOrganizer = members.find(m => m.user_id === user?.id)?.role === 'organizer';

  const totalCents = expenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
  const myShare = expenses
    .filter(e => e.split_member_ids?.includes(myMemberId ?? '') || e.split_type === 'all')
    .reduce((s, e) => {
      const count = e.split_type === 'all' ? members.length : (e.split_member_ids?.length ?? 1);
      return s + (e.amount_cents ?? 0) / Math.max(count, 1);
    }, 0);

  const filtered = activeCategory === 'All' ? expenses : expenses.filter(e => e.category === activeCategory);

  const handleMarkSettled = async (settlementId: string) => {
    try {
      const { error } = await supabase
        .from('expense_settlements')
        .update({ settled: true })
        .eq('id', settlementId);
      if (error) throw error;
      setSettlements(prev => prev.map(s => s.id === settlementId ? { ...s, settled: true } : s));
      showToast({ type: 'success', message: 'Marked as settled!' });
      track('expense_settled', { settlement_id: settlementId });
    } catch (err) {
      captureException(err, { screen: 'expenses', action: 'markSettled' });
      showToast({ type: 'error', message: 'Failed to mark as settled.' });
    }
  };

  const scale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="card" count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            {/* Summary */}
            <View style={{ padding: 16, backgroundColor: colors.card, margin: 16, borderRadius: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total Expenses</Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>${(totalCents / 100).toFixed(2)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>My Share</Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primary }}>${(myShare / 100).toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {/* Settlements */}
            {settlements.filter(s => !s.settled).length > 0 && (
              <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Settlements</Text>
                {settlements.filter(s => !s.settled).map(s => (
                  <SettlementCard
                    key={s.id}
                    settlement={s}
                    members={members}
                    onSettle={() => handleMarkSettled(s.id)}
                  />
                ))}
              </View>
            )}

            {/* Category Filter */}
            <ExpenseCategoryChips
              categories={[...CATEGORIES]}
              active={activeCategory}
              onSelect={setActiveCategory}
            />

            {error && (
              <Text style={{ color: colors.error ?? 'red', textAlign: 'center', padding: 12 }}>{error}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No expenses yet"
            description="Add your first expense to start tracking costs."
          />
        }
        renderItem={({ item }) => (
          <ExpenseRow
            expense={item}
            members={members}
            onPress={() => router.push(`/(modal)/expense-detail?expenseId=${item.id}`)}
          />
        )}
      />

      {/* FAB */}
      <Animated.View style={[fabStyle, { position: 'absolute', bottom: 24, right: 24 }]}>
        <Pressable
          onPress={() => router.push(`/(modal)/add-expense?tripId=${tripId}`)}
          onPressIn={() => { scale.value = withSpring(0.92); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          style={{ backgroundColor: colors.primary, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }}
        >
          <Plus size={28} color="#fff" />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
