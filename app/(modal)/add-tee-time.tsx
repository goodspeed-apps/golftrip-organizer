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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';
import { X, Mail, Plus, Minus, Save } from 'lucide-react-native';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const START = Date.now();

export default function AddTeeTimeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const params = useLocalSearchParams<{ trip_id: string; tee_time_id?: string; invite_email?: string }>();

  const [courseName, setCourseName] = useState('');
  const [teeDate, setTeeDate] = useState('');
  const [teeTime, setTeeTime] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [showEmailCard, setShowEmailCard] = useState(false);
  const [saving, setSaving] = useState(false);

  const scale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    track('screen_view_add_tee_time', { trip_id: params.trip_id });
    trackScreenLoad('add_tee_time', START);
    if (params.tee_time_id) loadExisting();
  }, []);

  const loadExisting = useCallback(async () => {
    const end = trackApiLatency('load_tee_time');
    try {
      const { data, error } = await supabase
        .from('tee_times')
        .select('*')
        .eq('id', params.tee_time_id!)
        .single();
      if (error) throw error;
      if (data) {
        setCourseName(data.course_name ?? '');
        setTeeDate(data.tee_date ?? '');
        setTeeTime(data.tee_time ?? '');
        setPlayerCount(data.player_count ?? 4);
        setConfirmationNumber(data.confirmation_number ?? '');
      }
    } catch (err) {
      captureException(err as Error, { screen: 'add_tee_time', action: 'load_existing' });
    } finally {
      end();
    }
  }, [params.tee_time_id]);

  const handleSave = useCallback(async () => {
    if (!courseName.trim() || !teeDate.trim() || !teeTime.trim()) {
      showToast('Please fill in course, date, and time.', 'error');
      return;
    }
    setSaving(true);
    scale.value = withSpring(0.96, {}, () => { scale.value = withSpring(1); });
    const end = trackApiLatency('save_tee_time');
    try {
      const payload = {
        trip_id: params.trip_id,
        course_name: courseName.trim(),
        tee_date: teeDate.trim(),
        tee_time: teeTime.trim(),
        player_count: playerCount,
        confirmation_number: confirmationNumber.trim() || null,
        source: 'manual',
        created_by: user?.id,
      };
      const { error } = params.tee_time_id
        ? await supabase.from('tee_times').update(payload).eq('id', params.tee_time_id)
        : await supabase.from('tee_times').insert(payload);
      if (error) throw error;
      track('tee_time_saved', { trip_id: params.trip_id, source: 'manual' });
      router.back();
    } catch (err) {
      captureException(err as Error, { screen: 'add_tee_time', action: 'save' });
      showToast("Couldn't save tee time. Try again.", 'error');
    } finally {
      setSaving(false);
      end();
    }
  }, [courseName, teeDate, teeTime, playerCount, confirmationNumber, params]);

  const s = {
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
    close: { padding: 8, borderRadius: 20, backgroundColor: colors.surfaceElevated },
    scroll: { flex: 1 },
    form: { padding: 20, gap: 16 },
    label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginBottom: 6 },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text },
    stepper: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 4 },
    stepperBtn: { padding: 10, borderRadius: 8, backgroundColor: colors.surfaceElevated },
    stepperCount: { flex: 1, textAlign: 'center' as const, fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.text },
    emailBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingVertical: 12 },
    emailLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.primary },
    emailCard: { backgroundColor: colors.primaryMuted, borderRadius: 12, padding: 14, gap: 6 },
    emailCardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primary },
    emailCardBody: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.text, lineHeight: 20 },
    stickyBottom: { padding: 20, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    saveBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' as const, flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 8 },
    saveBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.title}>{params.tee_time_id ? 'Edit Tee Time' : 'Add Tee Time'}</Text>
        <Pressable style={s.close} onPress={() => router.back()} accessibilityLabel="Close" accessibilityHint="Dismiss this form">
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
          <Animated.View entering={FadeInDown.duration(300)} style={s.form}>
            <View>
              <Text style={s.label}>Course Name</Text>
              <TextInput style={s.input} value={courseName} onChangeText={setCourseName} placeholder="e.g. Pebble Beach Golf Links" placeholderTextColor={colors.textMuted} returnKeyType="next" accessibilityLabel="Course name" />
            </View>
            <View>
              <Text style={s.label}>Date (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={teeDate} onChangeText={setTeeDate} placeholder="2025-07-04" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" accessibilityLabel="Tee date" />
            </View>
            <View>
              <Text style={s.label}>Tee Time (e.g. 7:30 AM)</Text>
              <TextInput style={s.input} value={teeTime} onChangeText={setTeeTime} placeholder="7:30 AM" placeholderTextColor={colors.textMuted} accessibilityLabel="Tee time" />
            </View>
            <View>
              <Text style={s.label}>Players</Text>
              <View style={s.stepper}>
                <Pressable style={s.stepperBtn} onPress={() => setPlayerCount(Math.max(1, playerCount - 1))} accessibilityLabel="Decrease player count" hitSlop={8}>
                  <Minus size={16} color={colors.primary} />
                </Pressable>
                <Text style={s.stepperCount}>{playerCount}</Text>
                <Pressable style={s.stepperBtn} onPress={() => setPlayerCount(Math.min(24, playerCount + 1))} accessibilityLabel="Increase player count" hitSlop={8}>
                  <Plus size={16} color={colors.primary} />
                </Pressable>
              </View>
            </View>
            <View>
              <Text style={s.label}>Confirmation # (optional)</Text>
              <TextInput style={s.input} value={confirmationNumber} onChangeText={setConfirmationNumber} placeholder="Optional booking reference" placeholderTextColor={colors.textMuted} accessibilityLabel="Confirmation number" />
            </View>
            <Pressable style={s.emailBtn} onPress={() => { setShowEmailCard(v => !v); track('tee_time_email_import_tapped', { trip_id: params.trip_id }); }} accessibilityLabel="Import from email" accessibilityHint="View your trip email address to forward a booking confirmation">
              <Mail size={16} color={colors.primary} />
              <Text style={s.emailLabel}>Import from Email</Text>
            </Pressable>
            {showEmailCard && (
              <Animated.View entering={FadeInDown.duration(250)} style={s.emailCard}>
                <Text style={s.emailCardTitle}>Forward your confirmation email to:</Text>
                <Text style={[s.emailCardBody, { fontFamily: 'Inter_600SemiBold', color: colors.primary }]}>{params.invite_email ?? 'check your trip details for the email address'}</Text>
                <Text style={s.emailCardBody}>{"We'll automatically parse the course name, date, time, and confirmation number and add it to your itinerary."}</Text>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
        <View style={s.stickyBottom}>
          <Animated.View style={saveStyle}>
            <Pressable
              style={[s.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              accessibilityLabel="Save tee time"
              accessibilityHint="Saves this tee time to your trip itinerary"
            >
              {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <><Save size={18} color={colors.textOnPrimary} /><Text style={s.saveBtnText}>Save Tee Time</Text></>}
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </SafeAreaView>
  );
}
