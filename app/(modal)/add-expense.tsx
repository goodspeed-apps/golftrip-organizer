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
  const { colors } = useThemeColors();
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
    const mapped = (data ?? []).map((m: { id: string; guest_name: string | null; users: { display_name: string }[] | { display_name: string } | null }) => ({
      id: m.id,
      display_name: m.guest_name ?? (Array.isArray(m.users) ? m.users[0]?.display_name : m.users?.display_name) ?? 'Guest',
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
    if (error) {
      captureException(error, { screen: 'AddExpense', action: 'save' });
      showToast('Failed to save expense', 'error');
      return;
    }
    showToast('Expense added!', 'success');
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Add Expense</Text>
          <Pressable onPress={() => router.back()}>
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Animated.View entering={FadeInDown.delay(50)}>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Category</Text>
            <ExpenseCategoryGrid selected={category} onSelect={setCategory} colors={colors} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Description (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Round at Pebble Beach"
              placeholderTextColor={colors.textSecondary}
              style={{ backgroundColor: colors.card, borderRadius: 10, padding: 12, color: colors.text }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150)}>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Amount</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder="$0.00"
              placeholderTextColor={colors.textSecondary}
              style={{ backgroundColor: colors.card, borderRadius: 10, padding: 12, color: colors.text, fontSize: 24, fontWeight: '700' }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Paid by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setPaidByMemberId(m.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: paidByMemberId === m.id ? colors.primary : colors.card,
                  }}
                >
                  <Text style={{ color: paidByMemberId === m.id ? '#fff' : colors.text }}>{m.display_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250)}>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Split</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['all', 'specific_people'] as SplitType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setSplitType(t)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
                    backgroundColor: splitType === t ? colors.primary : colors.card,
                  }}
                >
                  <Text style={{ color: splitType === t ? '#fff' : colors.text }}>
                    {t === 'all' ? 'Everyone' : 'Specific People'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {splitType === 'specific_people' && (
            <Animated.View entering={FadeInDown}>
              <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Select people</Text>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setSelectedPeople((prev) =>
                    prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                  )}
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 12,
                    backgroundColor: colors.card, borderRadius: 10, marginBottom: 8,
                  }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                    borderColor: selectedPeople.includes(m.id) ? colors.primary : colors.border,
                    backgroundColor: selectedPeople.includes(m.id) ? colors.primary : 'transparent',
                    marginRight: 10,
                  }} />
                  <Text style={{ color: colors.text }}>{m.display_name}</Text>
                </Pressable>
              ))}
            </Animated.View>
          )}
        </ScrollView>

        <Animated.View style={[{ padding: 16 }, saveStyle]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Save Expense</Text>
            )}
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </SafeAreaView>
  );
}
