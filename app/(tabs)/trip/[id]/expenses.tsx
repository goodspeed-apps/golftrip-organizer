import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Plus, DollarSign, User, ArrowRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { TripTabBar } from '@/components/TripTabBar';
import type { Expense } from '@/types/app';

export default function ExpensesScreen() {
  const colors = useThemeColors();
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [myCents, setMyCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const start = Date.now();
    const stop = trackApiLatency('fetch_expenses');
    try {
      setError(null);
      const [expRes, memberRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('trip_id', tripId).order('expense_date', { ascending: false }),
        supabase.from('trip_members').select('id').eq('trip_id', tripId).eq('user_id', user?.id ?? '').single(),
      ]);
      if (expRes.error) throw expRes.error;
      const all = (expRes.data ?? []) as Expense[];
      setExpenses(all);
      const total = all.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
      setTotalCents(total);
      const myMemberId = memberRes.data?.id;
      const mine = all.filter((e) => e.split_member_ids?.includes(myMemberId ?? ''));
      setMyCents(mine.reduce((s, e) => {
        const split = (e.split_member_ids ?? []).length || 1;
        return s + Math.round((e.amount_cents ?? 0) / split);
      }, 0));
      stop();
      trackScreenLoad('expenses', start);
    } catch (err) {
      captureException(err as Error, { screen: 'expenses', action: 'fetchData' });
      setError("Couldn't load expenses. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId, user?.id]);

  useEffect(() => {
    track('screen_view_expenses', { trip_id: tripId });
    fetchData();
  }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };
  const s = styles(colors);

  const SummaryHeader = (
    <Animated.View entering={FadeInDown.delay(0).duration(350)} style={s.summaryCard}>
      <View style={s.summaryItem}>
        <Text style={s.summaryLabel}>Trip Total</Text>
        <Text style={s.summaryAmount}>${((totalCents ?? 0) / 100).toFixed(2)}</Text>
      </View>
      <View style={s.divider} />
      <View style={s.summaryItem}>
        <Text style={s.summaryLabel}>Your Share</Text>
        <Text style={[s.summaryAmount, { color: colors.primary }]}>${((myCents ?? 0) / 100).toFixed(2)}</Text>
      </View>
      <View style={s.divider} />
      <Pressable
        style={s.settleBtn}
        onPress={() => router.push(`/(modal)/settlement?tripId=${tripId}`)}
        accessibilityLabel="View settlements"
        accessibilityHint="Shows who owes who for this trip"
      >
        <Text style={s.settleBtnText}>Settle Up</Text>
        <ArrowRight color={colors.primary} size={16} />
      </Pressable>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <LoadingSkeleton width="100%" height={100} borderRadius={16} style={{ margin: 16 }} />
        {[0, 1, 2].map((i) => (
          <LoadingSkeleton key={i} width="100%" height={70} borderRadius={12} style={{ marginHorizontal: 16, marginBottom: 8 }} />
        ))}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <TripTabBar tripId={tripId} active="expenses" tripName="" />
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={SummaryHeader}
        ListEmptyComponent={
          error ? (
            <View style={s.errorCard}><Text style={s.errorText}>{error}</Text></View>
          ) : (
            <EmptyState
              icon="dollar-sign"
              title="No expenses yet"
              description="Add the first expense and the split happens automatically!"
              actionLabel="Add Expense"
              onAction={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(`/(modal)/add-expense?tripId=${tripId}`);
              }}
            />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40 + 80).duration(280)} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <ExpenseRow expense={item} colors={colors} onPress={() => {
              track('tap_expense', { expense_id: item.id });
            }} />
          </Animated.View>
        )}
      />
      <Pressable
        style={s.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(`/(modal)/add-expense?tripId=${tripId}`);
        }}
        accessibilityLabel="Add expense"
        accessibilityHint="Opens the add expense form"
      >
        <Plus color={colors.textOnPrimary} size={26} strokeWidth={2.5} />
      </Pressable>
    </SafeAreaView>
  );
}

function ExpenseRow({ expense, colors, onPress }: { expense: Expense; colors: ReturnType<typeof useThemeColors>; onPress: () => void }) {
  const s = expRowStyles(colors);
  const perPerson = (expense.split_member_ids ?? []).length > 0
    ? Math.round((expense.amount_cents ?? 0) / (expense.split_member_ids ?? []).length)
    : (expense.amount_cents ?? 0);
  return (
    <Pressable onPress={onPress} style={s.card} accessibilityLabel={expense.description} accessibilityHint="Expense details">
      <View style={s.iconWrap}>
        <DollarSign color={colors.primary} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.desc}>{expense.description}</Text>
        <Text style={s.cat}>{expense.category ?? 'Other'} · {expense.expense_date ?? ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.amount}>${((expense.amount_cents ?? 0) / 100).toFixed(2)}</Text>
        <Text style={s.perPerson}>${(perPerson / 100).toFixed(2)}/ea</Text>
      </View>
    </Pressable>
  );
}

const expRowStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 12, gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  desc: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: c.text },
  cat: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: c.textSecondary, marginTop: 2 },
  amount: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: c.text },
  perPerson: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: c.textSecondary },
});

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 20, margin: 16, padding: 16, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    summaryAmount: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: colors.text, marginTop: 2 },
    divider: { width: 1, height: 40, backgroundColor: colors.divider },
    settleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    settleBtnText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: colors.primary },
    errorCard: { margin: 16, padding: 14, backgroundColor: colors.warningMuted, borderRadius: 12 },
    errorText: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.text },
    fab: { position: 'absolute', bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  });
