import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Spacing, BorderRadius } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { Toast, useToast } from '@/components/ui/Toast';

export default function CreateTripModal() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0 && startDate.length === 10 && endDate.length === 10;

  const handleCreate = async () => {
    if (!isValid || !user?.id) return;
    setSaving(true);
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: trip, error } = await supabase.from('trips').insert({
        organizer_id: user.id,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        invite_code: inviteCode,
        status: 'planning',
        recap_unlocked: false,
      }).select().single();

      if (error) throw error;

      await supabase.from('trip_members').insert({
        trip_id: trip.id,
        user_id: user.id,
        role: 'organizer',
        rsvp_status: 'accepted',
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      track('trip_created', { trip_id: trip.id });
      router.dismiss();
      router.push(`/(tabs)/trip/${trip.id}/itinerary` as never);
    } catch (err) {
      captureException(err as Error, { screen: 'create-trip', action: 'handleCreate' });
      showToast({ message: "Something went wrong. Try again!", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Plan a New Trip</Text>
          <Pressable onPress={() => router.dismiss()} accessibilityLabel="Close" style={styles.closeBtn}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
          <Text style={[styles.label, { color: colors.text }]}>Trip Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Augusta Weekend, Pebble Beach Trip…"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderRadius: BorderRadius.xl }]}
            testID="create-trip-name-input"
            accessibilityLabel="Trip name"
          />
          <Text style={[styles.label, { color: colors.text }]}>Start Date</Text>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderRadius: BorderRadius.xl }]}
            testID="create-trip-start-input"
            accessibilityLabel="Trip start date"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <Text style={[styles.label, { color: colors.text }]}>End Date</Text>
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderRadius: BorderRadius.xl }]}
            testID="create-trip-end-input"
            accessibilityLabel="Trip end date"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </ScrollView>
        <View style={[styles.footer, { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }]}>
          <Pressable
            onPress={handleCreate}
            disabled={!isValid || saving}
            accessibilityLabel="Create trip"
            accessibilityHint="Creates your new golf trip"
            testID="create-trip-submit"
            style={[
              styles.createBtn,
              { backgroundColor: isValid && !saving ? colors.primary : colors.border, borderRadius: BorderRadius.xl * 2 },
            ]}
          >
            <Text style={[styles.createBtnText, { color: colors.textOnPrimary }]}>
              {saving ? "Creating…" : "Let's Go! 🏌️"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  closeBtn: { padding: Spacing.xs },
  label: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', marginBottom: Spacing.xs },
  input: { borderWidth: 1, padding: Spacing.md, fontSize: 15, fontFamily: 'Manrope_400Regular', marginBottom: Spacing.sm },
  footer: {},
  createBtn: { paddingVertical: Spacing.md, alignItems: 'center' },
  createBtnText: { fontSize: 16, fontFamily: 'Outfit_700Bold' },
});
