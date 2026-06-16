import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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

  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [memberLimit, setMemberLimit] = useState('8');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!tripName.trim()) errs.tripName = 'Give your trip a name!';
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) errs.startDate = 'Use YYYY-MM-DD format';
    if (!endDate.match(/^\d{4}-\d{2}-\d{2}$/)) errs.endDate = 'Use YYYY-MM-DD format';
    if (new Date(endDate) < new Date(startDate)) errs.endDate = 'End date must be after start';
    const limit = parseInt(memberLimit, 10);
    if (isNaN(limit) || limit < 2 || limit > 50) errs.memberLimit = 'Between 2 and 50 players';
    return errs;
  };

  const handleCreate = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    track('tap_create_trip_submit', { name: tripName });
    try {
      const endApi = trackApiLatency('create_trip');
      const { data, error } = await supabase
        .from('trips')
        .insert({
          organizer_id: user.id,
          name: tripName.trim(),
          start_date: startDate,
          end_date: endDate,
          invite_code: generateInviteCode(),
          status: 'planning',
          member_limit: parseInt(memberLimit, 10),
          recap_unlocked: false,
        })
        .select()
        .single();
      endApi();
      if (error) throw error;

      await supabase.from('trip_members').insert({
        trip_id: data.id,
        user_id: user.id,
        role: 'organizer',
        rsvp_status: 'accepted',
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track('trip_created', { trip_id: data.id });
      showToast({ message: "Trip created! Time to get the crew together 🏌️", type: 'success' });
      router.replace(`/(tabs)/trip/${data.id}/itinerary` as never);
    } catch (err) {
      captureException(err as Error, { screen: 'create-trip', action: 'handleCreate' });
      showToast({ message: "Couldn't create trip. Try again!", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.xs,
  };

  const labelStyle = {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, color: colors.text }}>Plan a New Trip</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={{ padding: spacing.xs }}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.delay(50).duration(350)}>
            <Text style={labelStyle}>Trip Name</Text>
            <TextInput
              style={[inputStyle, fieldErrors.tripName ? { borderColor: colors.error } : {}]}
              placeholder={"e.g. Pebble Beach Boys Trip 2025"}
              placeholderTextColor={colors.textMuted}
              value={tripName}
              onChangeText={(v) => { setTripName(v); setFieldErrors((e) => ({ ...e, tripName: '' })); }}
              accessibilityLabel="Trip name"
            />
            {!!fieldErrors.tripName && <Text style={{ color: colors.error, fontFamily: 'Manrope_400Regular', fontSize: 12 }}>{fieldErrors.tripName}</Text>}

            <Text style={labelStyle}>Start Date</Text>
            <TextInput
              style={[inputStyle, fieldErrors.startDate ? { borderColor: colors.error } : {}]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={(v) => { setStartDate(v); setFieldErrors((e) => ({ ...e, startDate: '' })); }}
              keyboardType="numeric"
              accessibilityLabel="Trip start date"
            />
            {!!fieldErrors.startDate && <Text style={{ color: colors.error, fontFamily: 'Manrope_400Regular', fontSize: 12 }}>{fieldErrors.startDate}</Text>}

            <Text style={labelStyle}>End Date</Text>
            <TextInput
              style={[inputStyle, fieldErrors.endDate ? { borderColor: colors.error } : {}]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={endDate}
              onChangeText={(v) => { setEndDate(v); setFieldErrors((e) => ({ ...e, endDate: '' })); }}
              keyboardType="numeric"
              accessibilityLabel="Trip end date"
            />
            {!!fieldErrors.endDate && <Text style={{ color: colors.error, fontFamily: 'Manrope_400Regular', fontSize: 12 }}>{fieldErrors.endDate}</Text>}

            <Text style={labelStyle}>Max Players</Text>
            <TextInput
              style={[inputStyle, fieldErrors.memberLimit ? { borderColor: colors.error } : {}]}
              placeholder="8"
              placeholderTextColor={colors.textMuted}
              value={memberLimit}
              onChangeText={(v) => { setMemberLimit(v); setFieldErrors((e) => ({ ...e, memberLimit: '' })); }}
              keyboardType="numeric"
              accessibilityLabel="Maximum number of players"
            />
            {!!fieldErrors.memberLimit && <Text style={{ color: colors.error, fontFamily: 'Manrope_400Regular', fontSize: 12 }}>{fieldErrors.memberLimit}</Text>}

            <View style={{ height: spacing.xl }} />
          </Animated.View>
        </ScrollView>

        <View style={{ padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Pressable
            onPress={handleCreate}
            disabled={saving}
            accessibilityLabel="Create trip"
            accessibilityHint="Saves your trip and opens the workspace"
            style={{
              backgroundColor: colors.primary,
              borderRadius: 999,
              paddingVertical: spacing.md,
              alignItems: 'center',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: colors.textOnPrimary }}>
                Create Trip 🏌️
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
