import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Toast, useToast } from '@/components/ui/Toast';
import { createTrip } from '@/services/tripService';
import { captureException } from '@/lib/sentry';
import { Spacing, BorderRadius } from '@/lib/theme';

export default function CreateTripModal() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [memberLimit, setMemberLimit] = useState('8');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Give your trip a name!";
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.startDate = 'Use YYYY-MM-DD format';
    if (!endDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.endDate = 'Use YYYY-MM-DD format';
    if (endDate < startDate) e.endDate = "End date can't be before start";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate() || !user?.id) return;
    setSaving(true);
    try {
      const trip = await createTrip({
        organizer_id: user.id,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        member_limit: parseInt(memberLimit, 10) || 8,
        status: 'active',
        recap_unlocked: false,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      track('trip_created', { trip_id: trip.id });
      showToast("Trip created! Let's go! 🎉", 'success');
      setTimeout(() => router.replace(`/(tabs)/trip/${trip.id}/itinerary` as never), 600);
    } catch (e) {
      captureException(e as Error, { screen: 'create-trip', action: 'handleCreate' });
      showToast("Couldn't create trip. Try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg }}>
          <Animated.View entering={FadeInDown.springify()}>
            <View style={styles.topRow}>
              <Text style={[styles.title, { color: colors.text }]}>New Trip ⛳</Text>
              <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={styles.closeBtn}>
                <X size={22} color={colors.textSecondary} strokeWidth={1.5} />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Trip Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: errors.name ? colors.error : colors.border }]}
              placeholder="e.g. Augusta Boys Trip 2025"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
            {errors.name && <Text style={[styles.errText, { color: colors.error }]}>{errors.name}</Text>}

            <Text style={[styles.label, { color: colors.text }]}>Start Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: errors.startDate ? colors.error : colors.border }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
              keyboardType="numeric"
            />
            {errors.startDate && <Text style={[styles.errText, { color: colors.error }]}>{errors.startDate}</Text>}

            <Text style={[styles.label, { color: colors.text }]}>End Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: errors.endDate ? colors.error : colors.border }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
              keyboardType="numeric"
            />
            {errors.endDate && <Text style={[styles.errText, { color: colors.error }]}>{errors.endDate}</Text>}

            <Text style={[styles.label, { color: colors.text }]}>Max Golfers</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="8"
              placeholderTextColor={colors.textMuted}
              value={memberLimit}
              onChangeText={setMemberLimit}
              keyboardType="number-pad"
            />

            <Pressable
              style={[styles.btn, { backgroundColor: saving ? colors.primaryMuted : colors.primary }]}
              onPress={handleCreate}
              disabled={saving}
              accessibilityLabel="Create trip"
              accessibilityHint="Saves the new trip and opens the workspace"
            >
              <Text style={[styles.btnText, { color: colors.textOnPrimary }]}>
                {saving ? 'Creating…' : "Let's go! 🚀"}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  closeBtn: { padding: Spacing.xs },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 24 },
  label: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, marginBottom: Spacing.xs, marginTop: Spacing.md },
  input: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, fontFamily: 'Manrope_400Regular', fontSize: 15 },
  errText: { fontFamily: 'Manrope_400Regular', fontSize: 12, marginTop: Spacing.xs },
  btn: { borderRadius: 100, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.xl },
  btnText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
});
