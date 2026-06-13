import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { ExpenseCategoryGrid } from '@/components/ExpenseCategoryGrid';

const SPLIT_TYPES = ['all', 'day', 'people'] as const;
type SplitType = typeof SPLIT_TYPES[number];

export default function AddExpenseScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ trip_id: string }>();
  const tripId = params.trip_id ?? '';
  const start = Date.now();

  const [category, setCategory] = useState('green_fees');
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('all');
  const [members, setMembers] = useState<{ id: string; display_name: string }[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    track('screen_view_add_expense', { trip_id: tripId });
    loadMembers();
  }, []);

  const loadMembers = useCallback(async () => {
    const end = trackApiLatency('load_trip_members');
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select('id, user_id, guest_name, profiles:user_id(display_name)')
        .eq('trip_id', tripId);
      if (error) throw error;
      const mapped = (data ?? []).map((m: any) => ({
        id: m.id,
        display_name: m.profiles?.display_name ?? m.guest_name ?? 'Guest',
      }));
      setMembers(mapped);
      if (mapped.length > 0) setPaidByMemberId(mapped[0].id);
      trackScreenLoad('add_expense', start);
    } catch (err) {
      captureException(err as Error, { screen: 'add_expense', action: 'load_members' });
    } finally {
      end();
    }
  }, [tripId]);

  const handleSave = async () => {
    const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    if (!category || isNaN(amount) || amount <= 0 || !paidByMemberId) {
      Alert.alert('Missing info', "Please fill in amount and who paid.");
      return;
    }
    setSaving(true);
    track('expense_save_tapped', { category, split_type: splitType, amount_cents: Math.round(amount * 100) });
    const end = trackApiLatency('save_expense');
    try {
      const payload = {
        trip_id: tripId,
        category,
        description: description || category.replace('_', ' '),
        amount_cents: Math.round(amount * 100),
        currency: 'USD',
        paid_by_member_id: paidByMemberId,
        split_type: splitType,
        split_member_ids: splitType === 'people' ? selectedPeople : null,
        split_date: splitType === 'day' ? expenseDate : null,
        expense_date: expenseDate,
        is_settled: false,
        created_by: user?.id,
      };
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) throw error;
      track('expense_saved', { category, amount_cents: payload.amount_cents });
      router.back();
    } catch (err) {
      captureException(err as Error, { screen: 'add_expense', action: 'save_expense' });
      Alert.alert('Error', "Couldn't save expense. Please try again.");
    } finally {
      setSaving(false);
      end();
    }
  };

  const togglePerson = (id: string) =>
    setSelectedPeople(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Cancel" accessibilityHint="Dismiss add expense modal" hitSlop={8}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>Cancel</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add Expense</Text>
          <View style={{ width: 52 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(0).duration(300)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Category</Text>
            <ExpenseCategoryGrid selected={category} onSelect={(cat, desc) => { setCategory(cat); if (!description) setDescription(desc); }} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional note..."
              placeholderTextColor={colors.textMuted}
              style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border }}
              accessibilityLabel="Expense description"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Amount</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="$0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '700', color: colors.primary, borderWidth: 1, borderColor: colors.border }}
              accessibilityLabel="Expense amount in dollars"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Who Paid</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {members.map(m => (
                <Pressable key={m.id} onPress={() => setPaidByMemberId(m.id)}
                  accessibilityLabel={`Paid by ${m.display_name}`}
                  accessibilityHint="Set this member as the payer"
                  style={{ marginRight: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 2, borderColor: paidByMemberId === m.id ? colors.primary : colors.border, backgroundColor: paidByMemberId === m.id ? colors.primaryMuted : colors.surface }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: paidByMemberId === m.id ? colors.primary : colors.textSecondary }}>{m.display_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Split Between</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['all', 'day', 'people'] as SplitType[]).map(t => (
                <Pressable key={t} onPress={() => setSplitType(t)}
                  accessibilityLabel={`Split by ${t}`}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 2, alignItems: 'center', borderColor: splitType === t ? colors.accent : colors.border, backgroundColor: splitType === t ? colors.secondaryMuted : colors.surface }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: splitType === t ? colors.accent : colors.textSecondary, textTransform: 'capitalize' }}>{t === 'all' ? 'All' : t === 'day' ? 'A Day' : 'People'}</Text>
                </Pressable>
              ))}
            </View>
            {splitType === 'day' && (
              <TextInput value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={{ marginTop: 10, backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                accessibilityLabel="Expense date for day split" />
            )}
            {splitType === 'people' && (
              <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {members.map(m => (
                  <Pressable key={m.id} onPress={() => togglePerson(m.id)}
                    accessibilityLabel={`${selectedPeople.includes(m.id) ? 'Deselect' : 'Select'} ${m.display_name}`}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: selectedPeople.includes(m.id) ? colors.primary : colors.border, backgroundColor: selectedPeople.includes(m.id) ? colors.primaryMuted : colors.surface }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: selectedPeople.includes(m.id) ? colors.primary : colors.textSecondary }}>{m.display_name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Pressable onPress={handleSave} disabled={saving}
            accessibilityLabel="Save expense"
            accessibilityHint="Saves this expense and splits it among selected members"
            style={({ pressed }) => ({ backgroundColor: saving ? colors.border : colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textOnPrimary }}>{saving ? 'Saving…' : 'Save Expense'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
