import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';
import { CategoryGrid } from '@/components/expenses/CategoryGrid';
import { SplitSelector } from '@/components/expenses/SplitSelector';

export default function AddExpenseModal() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const params = useLocalSearchParams<{ tripId: string; memberId: string }>();

  const [category, setCategory] = useState<string>('green_fees');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState<string>(params.memberId ?? '');
  const [splitType, setSplitType] = useState<'all' | 'day' | 'people'>('all');
  const [splitDate, setSplitDate] = useState<string>('');
  const [splitMemberIds, setSplitMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const start = Date.now();
  React.useEffect(() => {
    track('screen_view_add_expense', { tripId: params.tripId });
    trackScreenLoad('AddExpense', start);
  }, []);

  const handleSave = useCallback(async () => {
    if (!amountStr || !paidBy || !params.tripId) {
      showToast('Please fill in amount and who paid.', 'error');
      return;
    }
    const amountCents = Math.round(parseFloat(amountStr.replace(/[^0-9.]/g, '')) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      showToast('Enter a valid amount.', 'error');
      return;
    }
    setSaving(true);
    const end = trackApiLatency('insert_expense');
    try {
      const { error } = await supabase.from('expenses').insert({
        trip_id: params.tripId,
        category,
        description,
        amount_cents: amountCents,
        currency: 'USD',
        paid_by_member_id: paidBy,
        split_type: splitType,
        split_member_ids: splitType === 'people' ? splitMemberIds : [],
        split_date: splitType === 'day' ? splitDate : null,
        expense_date: new Date().toISOString().slice(0, 10),
        is_settled: false,
        created_by: user?.id,
      });
      end();
      if (error) throw error;
      track('expense_added', { category, amountCents, splitType, tripId: params.tripId });
      router.back();
    } catch (err) {
      captureException(err as Error, { screen: 'AddExpense', action: 'save' });
      showToast('Failed to save expense.', 'error');
    } finally {
      setSaving(false);
    }
  }, [amountStr, paidBy, category, description, splitType, splitDate, splitMemberIds, params.tripId]);

  const scaleVal = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleVal.value }] }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View entering={FadeInDown.duration(300)} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Add Expense</Text>
            <Pressable onPress={() => router.back()} accessibilityLabel="Close" accessibilityHint="Dismiss this modal" style={{ padding: 8 }}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            <CategoryGrid selected={category} onSelect={(c, desc) => { setCategory(c); if (!description) setDescription(desc); }} />

            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginTop: 20, marginBottom: 6 }}>DESCRIPTION</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="e.g. Saturday round green fees" placeholderTextColor={colors.textMuted} style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text, borderWidth: 1, borderColor: colors.border }} />

            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginTop: 16, marginBottom: 6 }}>AMOUNT</Text>
            <TextInput value={amountStr} onChangeText={setAmountStr} placeholder="$0.00" keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary, borderWidth: 1, borderColor: colors.border }} />

            <SplitSelector tripId={params.tripId ?? ''} paidBy={paidBy} onPaidByChange={setPaidBy} splitType={splitType} onSplitTypeChange={setSplitType} splitDate={splitDate} onSplitDateChange={setSplitDate} splitMemberIds={splitMemberIds} onSplitMemberIdsChange={setSplitMemberIds} />
          </ScrollView>

          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Animated.View style={animStyle}>
              <Pressable onPressIn={() => { scaleVal.value = withSpring(0.97, { damping: 15 }); }} onPressOut={() => { scaleVal.value = withSpring(1, { damping: 15 }); }} onPress={handleSave} disabled={saving} accessibilityLabel="Save expense" accessibilityHint="Saves this expense and splits it among selected players" style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}>
                {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>Save Expense</Text>}
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </SafeAreaView>
  );
}
