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

export default function ExpensesScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
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
      const end = trackApiLatency('fetch_expenses', start);
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
    if (!isOrganizer && !isSubscribed) { router.push('/(modal)/paywall'); return; }
    track('mark_settled', { settlementId, tripId });
    try {
      const { error } = await supabase.from('expense_settlements').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', settlementId);
      if (error) throw error;
      setSettlements(prev => prev.map(s => s.id === settlementId ? { ...s, is_paid: true } : s));
      showToast('Balance marked as settled ✓', 'success');
    } catch (err) {
      captureException(err, { screen: 'expenses', action: 'markSettled' });
      showToast('Failed to update. Try again.', 'error');
    }
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Summary Banner */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontFamily: 'Inter_400Regular', opacity: 0.8 }}>Trip Total</Text>
            <Text style={{ color: colors.textOnPrimary, fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold' }}>${((totalCents ?? 0) / 100).toFixed(2)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontFamily: 'Inter_400Regular', opacity: 0.8 }}>My Share</Text>
            <Text style={{ color: colors.textOnPrimary, fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold' }}>${(myShare / 100).toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(300)}>
            <ExpenseCategoryChips categories={CATEGORIES as unknown as string[]} active={activeCategory} onSelect={setActiveCategory} />
            {error && (
              <View style={{ margin: 16, padding: 16, backgroundColor: colors.warningMuted, borderRadius: 12 }}>
                <Text style={{ color: colors.warning, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{error}</Text>
                <Pressable onPress={fetchData} accessibilityLabel="Retry loading expenses" accessibilityHint="Fetches expenses again">
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 8 }}>Retry</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index).duration(300)}>
            <ExpenseRow expense={item} members={members} />
          </Animated.View>
        )}
        ListEmptyComponent={!error ? <EmptyState icon="receipt" title="No expenses yet" description="Add your first expense to start splitting costs with your group." /> : null}
        ListFooterComponent={
          settlements.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <SettlementCard settlements={settlements} members={members} onMarkSettled={handleMarkSettled} isOrganizer={!!isOrganizer} />
            </Animated.View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* FAB */}
      <Pressable
        onPress={() => { track('tap_add_expense', { tripId }); router.push(`/(modal)/add-expense?tripId=${tripId}`); }}
        accessibilityLabel="Add expense"
        accessibilityHint="Opens a form to log a new trip expense"
        style={{ position: 'absolute', bottom: 28, right: 24, backgroundColor: colors.primary, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
      >
        <Plus size={24} color={colors.textOnPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

interface Expense { id: string; category: string; description: string; amount_cents: number; paid_by_member_id: string; split_type: string; split_member_ids: string[]; expense_date: string; is_settled: boolean; }
interface Settlement { id: string; from_member_id: string; to_member_id: string; amount_cents: number; currency: string; is_paid: boolean; venmo_deeplink?: string; paypal_deeplink?: string; }
interface TripMember { id: string; user_id: string; guest_name?: string; role: string; }
