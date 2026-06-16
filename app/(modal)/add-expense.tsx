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
  const themeContext = useThemeColors();
  const colors = themeContext.colors;
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
    const mapped = (data ?? []).map((m: { id: string; guest_name: string | null; users: { display_name: string }[] | { display_name: string } | null }) => {
      const usersData = m.users;
      let displayName = 'Guest';
      if (usersData) {
        if (Array.isArray(usersData)) {
          displayName = usersData[0]?.display_name ?? 'Guest';
        } else {
          displayName = (usersData as { display_name: string }).display_name ?? 'Guest';
        }
      }
      return {
        id: m.id,
        display_name: m.guest_name ?? displayName,
      };
    });
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
      split_member_ids: splitType === 'specific_people' ? selectedPeople : [],
    });
    end();
    setSaving(false);
    if (error) {
      captureException(error, { screen: 'AddExpense', action: 'handleSave' });
      showToast('Could not save expense. Try again.', 'error');
      return;
    }
    track('expense_saved', { category, amountCents, tripId });
    showToast('Expense added!', 'success');
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: 'Manrope_700Bold' }}>Add Expense</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          {/* Category */}
          <Animated.View entering={FadeInDown.delay(0).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, fontFamily: 'Manrope_600SemiBold' }}>Category</Text>
            <ExpenseCategoryGrid selected={category} onSelect={setCategory} colors={colors} />
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(50).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, fontFamily: 'Manrope_600SemiBold' }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Round at Pebble Beach"
              placeholderTextColor={colors.textSecondary}
              style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, color: colors.text, fontFamily: 'Manrope_400Regular', fontSize: 15, borderWidth: 1, borderColor: colors.border }}
            />
          </Animated.View>

          {/* Amount */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, fontFamily: 'Manrope_600SemiBold' }}>Amount (USD)</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, color: colors.text, fontFamily: 'Manrope_400Regular', fontSize: 15, borderWidth: 1, borderColor: colors.border }}
            />
          </Animated.View>

          {/* Paid By */}
          <Animated.View entering={FadeInDown.delay(150).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, fontFamily: 'Manrope_600SemiBold' }}>Paid By</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setPaidByMemberId(m.id)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: paidByMemberId === m.id ? colors.primary : colors.surface, borderWidth: 1, borderColor: paidByMemberId === m.id ? colors.primary : colors.border }}
                >
                  <Text style={{ color: paidByMemberId === m.id ? '#fff' : colors.text, fontFamily: 'Manrope_500Medium', fontSize: 13 }}>{m.display_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Split Type */}
          <Animated.View entering={FadeInDown.delay(200).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, fontFamily: 'Manrope_600SemiBold' }}>Split</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['all', 'specific_people'] as SplitType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setSplitType(t)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: splitType === t ? colors.primary : colors.surface, borderWidth: 1, borderColor: splitType === t ? colors.primary : colors.border }}
                >
                  <Text style={{ color: splitType === t ? '#fff' : colors.text, fontFamily: 'Manrope_500Medium', fontSize: 13 }}>{t === 'all' ? 'Everyone' : 'Specific People'}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Specific People Selector */}
          {splitType === 'specific_people' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, fontFamily: 'Manrope_600SemiBold' }}>Select People</Text>
              {members.map((m) => {
                const selected = selectedPeople.includes(m.id);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setSelectedPeople(prev => selected ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                    </View>
                    <Text style={{ color: colors.text, fontFamily: 'Manrope_400Regular', fontSize: 14 }}>{m.display_name}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          )}
        </ScrollView>

        {/* Save Button */}
        <Animated.View style={[saveStyle, { padding: 20 }]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Manrope_700Bold' }}>Save Expense</Text>}
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </SafeAreaView>
  );
}
