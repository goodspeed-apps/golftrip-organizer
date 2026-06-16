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
  const themeContext = useThemeColors();
  const colors = themeContext.colors;
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
      showToast("Trip created! Time to get the crew together 🏌️", 'success');
      router.replace(`/(tabs)/trip/${data.id}/itinerary` as never);
    } catch (err) {
      captureException(err as Error, { screen: 'create-trip', action: 'handleCreate' });
      showToast("Couldn't create trip. Try again!", 'error');
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
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, fontFamily: 'Manrope_700Bold' }}>New Trip</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 4 }} keyboardShouldPersistTaps="handled">
          {/* Trip Name */}
          <Animated.View entering={FadeInDown.delay(0).duration(350)}>
            <Text style={labelStyle}>Trip Name</Text>
            <TextInput
              value={tripName}
              onChangeText={setTripName}
              placeholder="Augusta Boys Trip 2025"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
            />
            {fieldErrors.tripName ? <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{fieldErrors.tripName}</Text> : null}
          </Animated.View>

          {/* Start Date */}
          <Animated.View entering={FadeInDown.delay(60).duration(350)}>
            <Text style={labelStyle}>Start Date</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
              keyboardType="numbers-and-punctuation"
            />
            {fieldErrors.startDate ? <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{fieldErrors.startDate}</Text> : null}
          </Animated.View>

          {/* End Date */}
          <Animated.View entering={FadeInDown.delay(120).duration(350)}>
            <Text style={labelStyle}>End Date</Text>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
              keyboardType="numbers-and-punctuation"
            />
            {fieldErrors.endDate ? <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{fieldErrors.endDate}</Text> : null}
          </Animated.View>

          {/* Member Limit */}
          <Animated.View entering={FadeInDown.delay(180).duration(350)}>
            <Text style={labelStyle}>Max Players</Text>
            <TextInput
              value={memberLimit}
              onChangeText={setMemberLimit}
              placeholder="8"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={inputStyle}
            />
            {fieldErrors.memberLimit ? <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{fieldErrors.memberLimit}</Text> : null}
          </Animated.View>

          {/* Emoji hint */}
          <Animated.View entering={FadeInDown.delay(240).duration(350)}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
              🏌️ Invite your crew after creating the trip
            </Text>
          </Animated.View>
        </ScrollView>

        {/* Create Button */}
        <View style={{ padding: 20 }}>
          <Pressable
            onPress={handleCreate}
            disabled={saving}
            style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Manrope_700Bold' }}>Create Trip 🏌️</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
