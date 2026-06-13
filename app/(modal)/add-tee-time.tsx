import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { X, Calendar, Clock, Users, Hash, Mail, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';
import { TeeTimeFormRow } from '@/components/TeeTimeFormRow';

export default function AddTeeTimeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { tripId, teeTimeId, inviteEmail } = useLocalSearchParams<{
    tripId: string;
    teeTimeId?: string;
    inviteEmail?: string;
  }>();
  const { toast, showToast } = useToast();
  const startTime = Date.now();

  const [courseName, setCourseName] = useState('');
  const [teeDate, setTeeDate] = useState('');
  const [teeTime, setTeeTime] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [confirmNumber, setConfirmNumber] = useState('');
  const [showEmailCard, setShowEmailCard] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveScale = useSharedValue(1);
  const emailCardScale = useSharedValue(1);

  useEffect(() => {
    track('screen_view_add_tee_time', { tripId, editing: !!teeTimeId });
    if (teeTimeId) loadExisting();
    else trackScreenLoad('AddTeeTime', startTime);
  }, []);

  const loadExisting = async () => {
    const end = trackApiLatency('load_tee_time');
    try {
      const { data, error } = await supabase
        .from('tee_times')
        .select('*')
        .eq('id', teeTimeId)
        .single();
      if (error) throw error;
      if (data) {
        setCourseName(data.course_name ?? '');
        setTeeDate(data.tee_date ?? '');
        setTeeTime(data.tee_time ?? '');
        setPlayerCount(data.player_count ?? 4);
        setConfirmNumber(data.confirmation_number ?? '');
      }
      trackScreenLoad('AddTeeTime', startTime);
    } catch (e) {
      captureException(e as Error, { screen: 'AddTeeTime', action: 'loadExisting' });
    } finally {
      end();
    }
  };

  const handleSave = async () => {
    if (!courseName.trim() || !teeDate.trim() || !teeTime.trim()) {
      showToast('Please fill in course, date and time.', 'error');
      return;
    }
    saveScale.value = withSpring(0.97, { damping: 15 }, () => { saveScale.value = withSpring(1); });
    setSaving(true);
    track('tee_time_save_tapped', { tripId, editing: !!teeTimeId });
    const end = trackApiLatency('save_tee_time');
    try {
      const payload = {
        trip_id: tripId,
        course_name: courseName.trim(),
        tee_date: teeDate.trim(),
        tee_time: teeTime.trim(),
        player_count: playerCount,
        confirmation_number: confirmNumber.trim() || null,
        source: 'manual',
        created_by: user?.id,
      };
      const { error } = teeTimeId
        ? await supabase.from('tee_times').update(payload).eq('id', teeTimeId)
        : await supabase.from('tee_times').insert(payload);
      if (error) throw error;
      track('tee_time_saved', { tripId, editing: !!teeTimeId });
      router.back();
    } catch (e) {
      captureException(e as Error, { screen: 'AddTeeTime', action: 'handleSave' });
      showToast('Could not save tee time. Please try again.', 'error');
    } finally {
      setSaving(false);
      end();
    }
  };

  const saveAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));
  const emailAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: emailCardScale.value }] }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View entering={FadeInDown.duration(300)} style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>
              {teeTimeId ? 'Edit Tee Time' : 'Add Tee Time'}
            </Text>
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Close modal"
              accessibilityHint="Dismisses the form without saving"
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            {/* Course Name */}
            <TeeTimeFormRow icon={<Calendar size={18} color={colors.primary} />} label="Course Name">
              <TextInput
                value={courseName}
                onChangeText={setCourseName}
                placeholder="e.g. Pebble Beach Golf Links"
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text }}
                accessibilityLabel="Course name input"
              />
            </TeeTimeFormRow>

            {/* Date */}
            <TeeTimeFormRow icon={<Calendar size={18} color={colors.primary} />} label="Date">
              <TextInput
                value={teeDate}
                onChangeText={setTeeDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text }}
                accessibilityLabel="Tee date input"
                keyboardType="numbers-and-punctuation"
              />
            </TeeTimeFormRow>

            {/* Time */}
            <TeeTimeFormRow icon={<Clock size={18} color={colors.primary} />} label="Time">
              <TextInput
                value={teeTime}
                onChangeText={setTeeTime}
                placeholder="e.g. 8:30 AM"
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text }}
                accessibilityLabel="Tee time input"
              />
            </TeeTimeFormRow>

            {/* Player Count */}
            <TeeTimeFormRow icon={<Users size={18} color={colors.primary} />} label="Players">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  onPress={() => setPlayerCount(Math.max(1, playerCount - 1))}
                  accessibilityLabel="Decrease player count"
                  accessibilityHint="Reduces number of players by one"
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronDown size={18} color={colors.primary} />
                </Pressable>
                <Text style={{ fontSize: 17, fontFamily: 'Inter_400Regular', color: colors.text, minWidth: 24, textAlign: 'center' }}>{playerCount}</Text>
                <Pressable
                  onPress={() => setPlayerCount(Math.min(20, playerCount + 1))}
                  accessibilityLabel="Increase player count"
                  accessibilityHint="Increases number of players by one"
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronUp size={18} color={colors.primary} />
                </Pressable>
              </View>
            </TeeTimeFormRow>

            {/* Confirmation Number */}
            <TeeTimeFormRow icon={<Hash size={18} color={colors.primary} />} label="Confirmation # (optional)">
              <TextInput
                value={confirmNumber}
                onChangeText={setConfirmNumber}
                placeholder="e.g. ABC123"
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text }}
                accessibilityLabel="Confirmation number input"
                autoCapitalize="characters"
              />
            </TeeTimeFormRow>

            {/* Import from Email */}
            <Animated.View style={[emailAnimStyle, { marginTop: 8 }]}>
              <Pressable
                onPress={() => {
                  emailCardScale.value = withSpring(0.97, { damping: 15 }, () => { emailCardScale.value = withSpring(1); });
                  setShowEmailCard(v => !v);
                  track('import_email_tapped', { tripId });
                }}
                accessibilityLabel="Import from email"
                accessibilityHint="Expands instructions for forwarding your booking confirmation email"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: colors.primaryMuted, borderWidth: 1, borderColor: colors.borderAccent }}
              >
                <Mail size={18} color={colors.primary} />
                <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.primary }}>
                  Import from Email
                </Text>
                {showEmailCard ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
              </Pressable>
              {showEmailCard && (
                <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 6 }}>
                    Forward your booking confirmation to:
                  </Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.primary, marginBottom: 10 }}>
                    {inviteEmail ?? 'your-trip@golftrip.app'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 18 }}>
                    {"We'll parse the course, date, time and confirmation number automatically. The tee time will appear in your itinerary within minutes."}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          </ScrollView>

          {/* Sticky Save */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.border }}>
            <Animated.View style={saveAnimStyle}>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                accessibilityLabel="Save tee time"
                accessibilityHint="Saves the tee time and adds it to the trip itinerary"
                style={{ height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
              >
                {saving
                  ? <ActivityIndicator color={colors.textOnPrimary} />
                  : <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>Save Tee Time</Text>
                }
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
      <Toast {...toast} />
    </SafeAreaView>
  );
}
