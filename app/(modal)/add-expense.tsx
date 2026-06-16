import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';
import { ExpenseCategoryGrid } from '@/components/ExpenseCategoryGrid';

type SplitType = 'all' | 'specific_people';

export default function AddExpenseScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [category, setCategory] = useState('green_fees');
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState<string>('');
  const [splitType, setSplitType] = useState<SplitType>('all');
  const [members, setMembers] = useState<{ id: string; display_name: string }[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const saveScale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  useEffect(() => {
    const start = Date.now();
    track('screen_view_add_expense', { tripId });
    fetchMembers().finally(() => trackScreenLoad('AddExpense', start));
  }, [tripId]);

  const fetchMembers = useCallback(async () => {
    if (!tripId) return;
    const end = trackApiLatency('fetchTripMembers');
    const { data, error } = await supabase
      .from('trip_members')
      .select('id, guest_name, users:user_id(display_name)')
      .eq('trip_id', tripId)
      .eq('rsvp_status', 'accepted');
    end();
    if (error) { captureException(error, { screen: 'AddExpense', action: 'fetchMembers' }); return; }
    const mapped = (data ?? []).map((m: { id: string; guest_name: string | null; users: { display_name: string } | null }) => ({
      id: m.id,
      display_name: m.guest_name ?? m.users?.display_name ?? 'Guest',
    }));
    setMembers(mapped);
    if (mapped.length > 0 && !paidByMemberId) setPaidByMemberId(mapped[0].id);
  }, [tripId]);

  const handleSave = async () => {
    const amountCents = Math.round(parseFloat(amountText.replace(/[^0-9.]/g, '')) * 100);
    if (!amountCents || amountCents <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!paidByMemberId) { showToast('Select who paid', 'error'); return; }
    saveScale.value = withSpring(0.95, {}, () => { saveScale.value = withSpring(1); });
    setSaving(true);
    track('expense_save_tapped', { category, amountCents, splitType, tripId });
    const end = trackApiLatency('insertExpense');
    const { error } = await supabase.from('expenses').insert({
      trip_id: tripId,
      category,
      description,
      amount_cents: amountCents,
      currency: 'USD',
      paid_by_member_id: paidByMemberId,
      split_type: splitType,
      split_member_ids: splitType === 'specific_people' ? selectedPeople : null,
      expense_date: new Date().toISOString(),
      is_settled: false,
      created_by: user?.id,
    });
    end();
    setSaving(false);
    if (error) { captureException(error, { screen: 'AddExpense', action: 'save' }); showToast('Failed to save expense', 'error'); return; }
    track('expense_saved', { category, amountCents, tripId });
    router.back();
  };

  const togglePerson = (id: string) =>
    setSelectedPeople(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add Expense</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" accessibilityHint="Dismiss add expense modal" hitSlop={12}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Category</Text>
            <ExpenseCategoryGrid selected={category} onSelect={(cat, desc) => { setCategory(cat); if (!description) setDescription(desc); }} colors={colors} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(50).springify()} style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Description</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="What was this for?" placeholderTextColor={colors.textMuted} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }} accessibilityLabel="Description" />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).springify()} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Amount</Text>
            <TextInput value={amountText} onChangeText={setAmountText} placeholder="$0.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 22, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border }} accessibilityLabel="Amount" />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).springify()} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Paid By</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {members.map(m => (
                <Pressable key={m.id} onPress={() => setPaidByMemberId(m.id)} accessibilityLabel={`Paid by ${m.display_name}`} style={{ marginRight: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: paidByMemberId === m.id ? colors.primary : colors.surface, borderWidth: 1, borderColor: paidByMemberId === m.id ? colors.primary : colors.border }}>
                  <Text style={{ color: paidByMemberId === m.id ? colors.textOnPrimary : colors.text, fontWeight: '600', fontSize: 14 }}>{m.display_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(200).springify()} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Split</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['all', 'specific_people'] as SplitType[]).map(t => (
                <Pressable key={t} onPress={() => setSplitType(t)} accessibilityLabel={t === 'all' ? 'Split all players' : 'Split specific people'} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: splitType === t ? colors.primary : colors.surface, borderWidth: 1, borderColor: splitType === t ? colors.primary : colors.border }}>
                  <Text style={{ color: splitType === t ? colors.textOnPrimary : colors.text, fontWeight: '600', fontSize: 14 }}>{t === 'all' ? 'All Players' : 'Select People'}</Text>
                </Pressable>
              ))}
            </View>
            {splitType === 'specific_people' && (
              <Animated.View entering={FadeInDown.springify()} style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {members.map(m => {
                  const sel = selectedPeople.includes(m.id);
                  return (
                    <Pressable key={m.id} onPress={() => togglePerson(m.id)} accessibilityLabel={`Toggle ${m.display_name}`} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? colors.accent : colors.surface, borderWidth: 1, borderColor: sel ? colors.accent : colors.border }}>
                      <Text style={{ color: sel ? colors.textOnPrimary : colors.text, fontWeight: '600', fontSize: 14 }}>{m.display_name}</Text>
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Animated.View style={saveStyle}>
            <Pressable onPress={handleSave} disabled={saving} accessibilityLabel="Save expense" accessibilityHint="Saves this expense and splits it among selected players" style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}>
              {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={{ color: colors.textOnPrimary, fontSize: 16, fontWeight: '700' }}>Save Expense</Text>}
            </Pressable>
          </Animated.View>
        </View>
        <Toast {...toast} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
