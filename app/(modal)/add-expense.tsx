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
  const colors = themeContext.colors ?? themeContext;
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
    const mapped = (data ?? []).map((m: { id: string; guest_name: string | null; users: { display_name: string } | { display_name: string }[] | null }) => {
      const usersData = m.users;
      let displayName = 'Guest';
      if (Array.isArray(usersData) && usersData.length > 0) {
        displayName = usersData[0].display_name ?? 'Guest';
      } else if (usersData && !Array.isArray(usersData)) {
        displayName = usersData.display_name ?? 'Guest';
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
      expense_date: new Date().toISOString().split('T')[0],
    });
    end();
    if (error) {
      captureException(error, { screen: 'AddExpense', action: 'handleSave' });
      showToast('Failed to save expense', 'error');
      setSaving(false);
      return;
    }
    track('expense_saved', { category, amountCents, tripId });
    showToast('Expense added!', 'success');
    setSaving(false);
    router.back();
  };

  const c = colors as Record<string, string>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Add Expense</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <X size={24} color={c.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(0).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</Text>
            <ExpenseCategoryGrid
              selected={category}
              onSelect={setCategory}
              colors={c}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What was this for?"
              placeholderTextColor={c.textSecondary}
              style={{ backgroundColor: c.surface, borderRadius: 12, padding: 14, fontSize: 16, color: c.text, borderWidth: 1, borderColor: c.border }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="$0.00"
              placeholderTextColor={c.textSecondary}
              keyboardType="decimal-pad"
              style={{ backgroundColor: c.surface, borderRadius: 12, padding: 14, fontSize: 24, fontWeight: '700', color: c.text, borderWidth: 1, borderColor: c.border }}
            />
          </Animated.View>

          {members.length > 0 && (
            <Animated.View entering={FadeInDown.delay(180).duration(350)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Paid By</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {members.map(m => (
                  <Pressable
                    key={m.id}
                    onPress={() => setPaidByMemberId(m.id)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8,
                      backgroundColor: paidByMemberId === m.id ? c.primary : c.surface,
                      borderWidth: 1, borderColor: paidByMemberId === m.id ? c.primary : c.border,
                    }}
                  >
                    <Text style={{ color: paidByMemberId === m.id ? '#fff' : c.text, fontWeight: '600' }}>{m.display_name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(240).duration(350)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Split</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['all', 'specific_people'] as SplitType[]).map(type => (
                <Pressable
                  key={type}
                  onPress={() => setSplitType(type)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
                    backgroundColor: splitType === type ? c.primary : c.surface,
                    borderWidth: 1, borderColor: splitType === type ? c.primary : c.border,
                  }}
                >
                  <Text style={{ color: splitType === type ? '#fff' : c.text, fontWeight: '600', fontSize: 13 }}>
                    {type === 'all' ? 'All Members' : 'Specific People'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {splitType === 'specific_people' && members.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(350)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Select People</Text>
              {members.map(m => (
                <Pressable
                  key={m.id}
                  onPress={() => setSelectedPeople(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, backgroundColor: selectedPeople.includes(m.id) ? c.primaryMuted : c.surface, borderWidth: 1, borderColor: selectedPeople.includes(m.id) ? c.primary : c.border }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selectedPeople.includes(m.id) ? c.primary : c.border, backgroundColor: selectedPeople.includes(m.id) ? c.primary : 'transparent', marginRight: 10 }} />
                  <Text style={{ color: c.text, fontWeight: '500' }}>{m.display_name}</Text>
                </Pressable>
              ))}
            </Animated.View>
          )}
        </ScrollView>

        <Animated.View style={[{ padding: 20, paddingBottom: 32 }, saveStyle]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: saving ? c.primaryMuted : c.primary, borderRadius: 14, padding: 16, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save Expense</Text>}
          </Pressable>
        </Animated.View>

        {toast && <Toast message={toast.message} type={toast.type} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
