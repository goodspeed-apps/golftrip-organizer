import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
import { Plus, DollarSign, CheckCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePaywall } from '@/hooks/usePaywall';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ExpenseSummaryBanner } from '@/components/ExpenseSummaryBanner';
import { ExpenseRow } from '@/components/ExpenseRow';
import { SettlementCard } from '@/components/SettlementCard';

const CATEGORIES = ['All', 'Green Fees', 'Cart', 'Lodging', 'Meals', 'Side Bets', 'Misc'] as const;

export default function ExpensesScreen() {
  const colors = useThemeColors();
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { openPaywall } = usePaywall();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const start = Date.now();
    const done = trackApiLatency('expenses_fetch');
    try {
      const [expRes, settleRes, memRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('trip_id', tripId).order('expense_date', { ascending: false }),
        supabase.from('expense_settlements').select('*').eq('trip_id', tripId),
        supabase.from('trip_members').select('id, user_id, guest_name, role').eq('trip_id', tripId),
      ]);
      if (expRes.error) throw expRes.error;
      if (settleRes.error) throw settleRes.error;
      if (memRes.error) throw memRes.error;
      setExpenses((expRes.data ?? []) as Expense[]);
      setSettlements((settleRes.data ?? []) as Settlement[]);
      setMembers((memRes.data ?? []) as TripMember[]);
      setError(null);
      trackScreenLoad('expenses', start);
      track('screen_view_expenses', { trip_id: tripId });
    } catch (e) {
      captureException(e as Error, { screen: 'expenses', action: 'fetchData' });
      setError('Could not load expenses.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      done();
    }
  }, [tripId, track]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const myMember = members.find(m => m.user_id === user?.id);
  const isOrganizer = myMember?.role === 'organizer';
  const filtered = activeCategory === 'All' ? expenses : expenses.filter(e => e.category === activeCategory);
  const totalCents = expenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
  const myShare = expenses.reduce((s, e) => {
    if (!myMember) return s;
    const ids: string[] = e.split_member_ids ?? [];
    if (ids.includes(myMember.id)) return s + Math.round((e.amount_cents ?? 0) / ids.length);
    return s;
  }, 0);

  const markSettled = async (settlementId: string) => {
    track('expense_mark_settled', { settlement_id: settlementId });
    const { error: err } = await supabase
      .from('expense_settlements').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', settlementId);
    if (err) captureException(err, { screen: 'expenses', action: 'markSettled' });
    else fetchData();
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;
  if (error) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.error, fontFamily: 'Inter_400Regular', fontSize: 15 }}>{error}</Text>
      <Pressable onPress={fetchData} style={{ marginTop: 12, padding: 12 }} accessibilityLabel="Retry loading expenses" accessibilityHint="Fetches expense data again">
        <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Retry</Text>
      </Pressable>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View>
              <ExpenseSummaryBanner totalCents={totalCents} myShareCents={myShare} />
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <Pressable key={cat} onPress={() => setActiveCategory(cat)}
                    accessibilityLabel={`Filter by ${cat}`} accessibilityHint="Filters the expense list"
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, minHeight: 44, justifyContent: 'center',
                      backgroundColor: activeCategory === cat ? colors.primary : colors.surface,
                      borderWidth: 1, borderColor: activeCategory === cat ? colors.primary : colors.border }}>
                    <Text style={{ color: activeCategory === cat ? colors.textOnPrimary : colors.text, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <ExpenseRow expense={item} members={members} index={index}
              expanded={expandedId === item.id} onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)} />
          )}
          ListEmptyComponent={<EmptyState icon={DollarSign} title="No expenses yet" description="Add your first expense to start tracking group costs." />}
          ListFooterComponent={
            settlements.length > 0 ? (
              <SettlementCard settlements={settlements} members={members} isOrganizer={isOrganizer}
                onMarkSettled={markSettled} onPayPress={() => openPaywall('settlement_payment')} />
            ) : null
          }
        />
      </Animated.View>
      <Pressable onPress={() => { track('tap_add_expense', { trip_id: tripId }); router.push('/(modal)/add-expense'); }}
        accessibilityLabel="Add expense" accessibilityHint="Opens the add expense form"
        style={{ position: 'absolute', bottom: 28, right: 24, width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
          shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 }}>
        <Plus size={26} color={colors.textOnPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

type Expense = { id: string; category: string; description: string; amount_cents: number; paid_by_member_id: string; split_member_ids: string[]; expense_date: string; is_settled: boolean; };
type Settlement = { id: string; from_member_id: string; to_member_id: string; amount_cents: number; is_paid: boolean; venmo_deeplink: string | null; paypal_deeplink: string | null; };
type TripMember = { id: string; user_id: string | null; guest_name: string | null; role: string; };
