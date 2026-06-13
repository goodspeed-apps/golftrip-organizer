import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackApiLatency } from '@/lib/performance';
import { useToast } from '@/components/ui/Toast';
import { Spacing, BorderRadius } from '@/lib/theme';

const spacing = Spacing;
const radii = BorderRadius;

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CreateTripModal() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [memberLimit, setMemberLimit] = useState('8');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Give your trip a name.';
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.startDate = 'Use YYYY-MM-DD format.';
    if (!endDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.endDate = 'Use YYYY-MM-DD format.';
    if (endDate < startDate) e.endDate = 'End date must be after start date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate() || !user?.id) return;
    setSaving(true);
    track('tap_create_trip_submit', { name });
    const end = trackApiLatency('create_trip');
    try {
      const { data: trip, error } = await supabase
        .from('trips')
        .insert({
          organizer_id: user.id,
          name: name.trim(),
          start_date: startDate,
          end_date: endDate,
          invite_code: generateInviteCode(),
          status: 'active',
          member_limit: parseInt(memberLimit, 10) || 8,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('trip_members').insert({
        trip_id: trip.id,
        user_id: user.id,
        role: 'organizer',
        rsvp_status: 'accepted',
      });
      end();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      showToast('Trip created! 🎉', 'success');
      router.replace(`/(tabs)/trip/${trip.id}/itinerary` as never);
    } catch (err) {
      captureException(err as Error, { screen: 'CreateTrip', action: 'handleCreate' });
      setErrors({ submit: "Couldn't create your trip. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.handleBar} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>New Trip</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" accessibilityHint="Dismisses this sheet" style={styles.closeBtn}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <Text style={styles.label}>Trip Name</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="e.g. Augusta Boys Trip 2025"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              accessibilityLabel="Trip name input"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, errors.startDate ? styles.inputError : null]}
              placeholder="2025-06-14"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Start date input"
            />
            {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, errors.endDate ? styles.inputError : null]}
              placeholder="2025-06-17"
              placeholderTextColor={colors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="End date input"
            />
            {errors.endDate && <Text style={styles.errorText}>{errors.endDate}</Text>}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Text style={styles.label}>Max Members</Text>
            <TextInput
              style={styles.input}
              placeholder="8"
              placeholderTextColor={colors.textMuted}
              value={memberLimit}
              onChangeText={setMemberLimit}
              keyboardType="number-pad"
              accessibilityLabel="Member limit input"
            />
          </Animated.View>

          {errors.submit && (
            <View style={styles.submitError}>
              <Text style={styles.errorText}>{errors.submit}</Text>
            </View>
          )}

          <Pressable
            onPress={handleCreate}
            disabled={saving}
            accessibilityLabel="Create trip"
            accessibilityHint="Saves your new trip and opens the workspace"
            style={({ pressed }) => [styles.createBtn, saving && styles.createBtnDisabled, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <Text style={styles.createBtnText}>{saving ? 'Creating...' : 'Create Trip ⛳'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface },
    handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    title: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: colors.text },
    closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    form: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
    label: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, paddingHorizontal: spacing.md, paddingVertical: 14, fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.text, backgroundColor: colors.background, marginBottom: spacing.sm },
    inputError: { borderColor: colors.error },
    errorText: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: colors.error, marginTop: -spacing.xs, marginBottom: spacing.xs },
    submitError: { backgroundColor: colors.warningMuted, borderRadius: radii.md, padding: spacing.md },
    createBtn: { backgroundColor: colors.primary, borderRadius: radii.xl, paddingVertical: 16, alignItems: 'center', marginTop: spacing.md },
    createBtnDisabled: { opacity: 0.6 },
    createBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
  });
