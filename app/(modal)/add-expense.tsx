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

type TripMemberRow = {
  id: string;
  guest_name: string | null;
  users: { display_name: string } | { display_name: string }[] | null;
};

export default function AddExpenseScreen() {
  const colorsContext = useThemeColors();
  const colors = colorsContext.colors ?? colorsContext;
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
    const mapped = (data ?? []).map((m: TripMemberRow) => {
      let displayName = 'Guest';
      if (m.guest_name) {
        displayName = m.guest_name;
      } else if (m.users) {
        const usersVal = m.users;
        if (Array.isArray(usersVal)) {
          displayName = usersVal[0]?.display_name ?? 'Guest';
        } else {
          displayName = (usersVal as { display_name: string }).display_name ?? 'Guest';
        }
      }
      return { id: m.id, display_name: displayName };
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
      paid_by_member_id: paidByMemberId,
      split_type: splitType,
      split_member_ids: splitType === 'specific_people' ? selectedPeople : [],
    });
    end();
    setSaving(false);
    if (error) {
      captureException(error, { screen: 'AddExpense', action: 'handleSave' });
      showToast('Failed to save expense', 'error');
      return;
    }
    track('expense_saved', { category, amountCents, splitType, tripId });
    showToast('Expense added!', 'success');
    router.back();
  };

  const themeColors = colors as Record<string, string>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: themeColors.text }}>Add Expense</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <X size={24} color={themeColors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(0).duration(300)}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>CATEGORY</Text>
            <ExpenseCategoryGrid
              selected={category}
              onSelect={setCategory}
              colors={themeColors}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(300)}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>DESCRIPTION</Text>
            <TextInput
              style={{ backgroundColor: themeColors.surface, borderRadius: 12, padding: 14, color: themeColors.text, fontSize: 16 }}
              placeholder="What was this for?"
              placeholderTextColor={themeColors.textSecondary}
              value={description}
              onChangeText={setDescription}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(300)}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>AMOUNT</Text>
            <TextInput
              style={{ backgroundColor: themeColors.surface, borderRadius: 12, padding: 14, color: themeColors.text, fontSize: 24, fontWeight: '700' }}
              placeholder="$0.00"
              placeholderTextColor={themeColors.textSecondary}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(300)}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>PAID BY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setPaidByMemberId(m.id)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: paidByMemberId === m.id ? themeColors.primary : themeColors.surface,
                  }}
                >
                  <Text style={{ color: paidByMemberId === m.id ? '#fff' : themeColors.text, fontWeight: '600' }}>{m.display_name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(300)}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>SPLIT</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['all', 'specific_people'] as SplitType[]).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setSplitType(opt)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
                    backgroundColor: splitType === opt ? themeColors.primary : themeColors.surface,
                  }}
                >
                  <Text style={{ color: splitType === opt ? '#fff' : themeColors.text, fontWeight: '600' }}>
                    {opt === 'all' ? 'Everyone' : 'Specific People'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {splitType === 'specific_people' && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {members.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setSelectedPeople(prev =>
                      prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                    )}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
                      backgroundColor: selectedPeople.includes(m.id) ? themeColors.primary : themeColors.surface,
                    }}
                  >
                    <Text style={{ color: selectedPeople.includes(m.id) ? '#fff' : themeColors.text }}>{m.display_name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(300)} style={saveStyle}>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={{
                backgroundColor: themeColors.primary, borderRadius: 14, padding: 16,
                alignItems: 'center', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save Expense</Text>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </SafeAreaView>
  );
}
