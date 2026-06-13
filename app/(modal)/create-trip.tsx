import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { X, MapPin, Calendar, Users } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackApiLatency } from '@/lib/performance';
import { useToast } from '@/components/ui/Toast';
import type { CreateTripPayload } from '@/types/app';

export default function CreateTripModal() {
  const colors = useThemeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [memberLimit, setMemberLimit] = useState('8');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Give your trip a name.';
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) errs.startDate = 'Use YYYY-MM-DD format.';
    if (!endDate.match(/^\d{4}-\d{2}-\d{2}$/)) errs.endDate = 'Use YYYY-MM-DD format.';
    if (endDate < startDate) errs.endDate = "End date can't be before start.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate() || !user?.id) return;
    setSaving(true);
    track('tap_create_trip_submit', { name });
    const stop = trackApiLatency('create_trip');
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const payload: CreateTripPayload = {
        organizer_id: user.id,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        invite_code: inviteCode,
        member_limit: parseInt(memberLimit, 10) || 8,
        status: 'planning',
      };
      const { data, error } = await supabase.from('trips').insert(payload).select().single();
      if (error) throw error;
      await supabase.from('trip_members').insert({
        trip_id: data.id,
        user_id: user.id,
        role: 'organizer',
        rsvp_status: 'accepted',
      });
      stop();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      track('trip_created', { trip_id: data.id });
      showToast({ message: "Trip created! Let's go! 🏌️", type: 'success' });
      router.replace(`/(tabs)/trip/${data.id}/itinerary`);
    } catch (err) {
      stop();
      captureException(err as Error, { screen: 'create-trip', action: 'handleCreate' });
      showToast({ message: "Couldn't create trip. Try again.", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.dragBar} />
        <View style={s.titleRow}>
          <Text style={s.title}>New Trip</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={s.closeBtn}>
            <X color={colors.textSecondary} size={22} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <Text style={s.label}>Trip Name</Text>
            <TextInput
              style={[s.input, fieldErrors.name ? s.inputError : null]}
              placeholder="e.g. Pebble Beach 2025"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              accessibilityLabel="Trip name"
            />
            {fieldErrors.name && <Text style={s.fieldErr}>{fieldErrors.name}</Text>}
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Start Date</Text>
              <TextInput
                style={[s.input, fieldErrors.startDate ? s.inputError : null]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numeric"
                accessibilityLabel="Start date"
              />
              {fieldErrors.startDate && <Text style={s.fieldErr}>{fieldErrors.startDate}</Text>}
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>End Date</Text>
              <TextInput
                style={[s.input, fieldErrors.endDate ? s.inputError : null]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numeric"
                accessibilityLabel="End date"
              />
              {fieldErrors.endDate && <Text style={s.fieldErr}>{fieldErrors.endDate}</Text>}
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(300)}>
            <Text style={s.label}>Max Players</Text>
            <TextInput
              style={s.input}
              placeholder="8"
              placeholderTextColor={colors.textMuted}
              value={memberLimit}
              onChangeText={setMemberLimit}
              keyboardType="number-pad"
              accessibilityLabel="Maximum number of players"
            />
          </Animated.View>
        </ScrollView>
        <View style={s.footer}>
          <Pressable
            style={[s.createBtn, saving && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={saving}
            accessibilityLabel="Create trip"
            accessibilityHint="Saves the trip and opens the trip workspace"
          >
            <Text style={s.createBtnText}>{saving ? 'Creating…' : 'Create Trip 🏌️'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    dragBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 8 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
    title: { fontSize: 22, fontFamily: 'Outfit_700Bold', color: colors.text },
    closeBtn: { padding: 8 },
    form: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
    label: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Manrope_400Regular', color: colors.text, backgroundColor: colors.background },
    inputError: { borderColor: colors.error },
    fieldErr: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: colors.error, marginTop: 4 },
    row: { flexDirection: 'row' },
    footer: { paddingHorizontal: 16, paddingBottom: 16 },
    createBtn: { backgroundColor: colors.primary, borderRadius: 28, paddingVertical: 16, alignItems: 'center' },
    createBtnText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textOnPrimary },
  });
