import React, { useState, useEffect, useRef } from 'react';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { X, Mail, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast } from '@/components/ui/Toast';

export default function AddTeeTimeModal() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ trip_id: string; tee_time_id?: string; invite_email?: string }>();
  const start = useRef(Date.now());

  const [courseName, setCourseName] = useState('');
  const [teeDate, setTeeDate] = useState('');
  const [teeTime, setTeeTime] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [confirmNumber, setConfirmNumber] = useState('');
  const [showEmailInfo, setShowEmailInfo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    track('screen_view_add_tee_time', { trip_id: params.trip_id });
    if (params.tee_time_id) loadExisting();
    else trackScreenLoad('AddTeeTime', start.current);
  }, []);

  async function loadExisting() {
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
        setConfirmNumber(data.confirmation_number ?? '');
      }
    } catch (e) {
      captureException(e as Error, { screen: 'AddTeeTime', action: 'loadExisting' });
    } finally {
      end();
      trackScreenLoad('AddTeeTime', start.current);
    }
  }

  async function handleSave() {
    if (!courseName.trim() || !teeDate.trim() || !teeTime.trim()) {
      showToast('Please fill in course, date, and time.', 'error');
      return;
    }
    setSaving(true);
    track('tee_time_save_tapped', { trip_id: params.trip_id, is_edit: !!params.tee_time_id });
    const end = trackApiLatency('save_tee_time');
    try {
      const payload = {
        trip_id: params.trip_id,
        course_name: courseName.trim(),
        tee_date: teeDate.trim(),
        tee_time: teeTime.trim(),
        player_count: playerCount,
        confirmation_number: confirmNumber.trim() || null,
        source: 'manual',
        created_by: user?.id,
      };
      if (params.tee_time_id) {
        const { error } = await supabase.from('tee_times').update(payload).eq('id', params.tee_time_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tee_times').insert(payload);
        if (error) throw error;
      }
      showToast(params.tee_time_id ? 'Tee time updated!' : 'Tee time added!', 'success');
      router.back();
    } catch (e) {
      captureException(e as Error, { screen: 'AddTeeTime', action: 'handleSave' });
      showToast('Could not save tee time. Try again.', 'error');
    } finally {
      setSaving(false);
      end();
    }
  }

  const s = {
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: 18, fontWeight: '700' as const, color: colors.text, fontFamily: 'PlusJakartaSans_700Bold' },
    scroll: { flex: 1, padding: 20 },
    label: { fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 6, marginTop: 16, fontFamily: 'Inter_600SemiBold' },
    input: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.text, fontFamily: 'Inter_400Regular' },
    stepperRow: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8 },
    stepperBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryMuted, alignItems: 'center' as const, justifyContent: 'center' as const },
    stepperVal: { flex: 1, textAlign: 'center' as const, fontSize: 18, fontWeight: '700' as const, color: colors.text, fontFamily: 'PlusJakartaSans_700Bold' },
    emailCard: { backgroundColor: colors.surfaceElevated, borderRadius: 14, borderWidth: 1, borderColor: colors.borderAccent, padding: 16, marginTop: 20 },
    emailTitle: { fontSize: 14, fontWeight: '600' as const, color: colors.primary, fontFamily: 'Inter_600SemiBold' },
    emailBody: { fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 20, fontFamily: 'Inter_400Regular' },
    emailAddress: { fontSize: 13, fontWeight: '700' as const, color: colors.accent, marginTop: 6, fontFamily: 'Inter_700Bold' },
    footer: { padding: 20, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    saveBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
    saveTxt: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '700' as const, fontFamily: 'PlusJakartaSans_700Bold' },
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <Text style={s.title}>{params.tee_time_id ? 'Edit Tee Time' : 'Add Tee Time'}</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" accessibilityHint="Dismiss this modal" style={{ padding: 4 }}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <Text style={s.label}>Course Name</Text>
            <TextInput style={s.input} value={courseName} onChangeText={setCourseName} placeholder="e.g. Pebble Beach Golf Links" placeholderTextColor={colors.textMuted} accessibilityLabel="Course name" returnKeyType="next" />

            <Text style={s.label}>Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={teeDate} onChangeText={setTeeDate} placeholder="2025-07-04" placeholderTextColor={colors.textMuted} accessibilityLabel="Tee date" keyboardType="numbers-and-punctuation" returnKeyType="next" />

            <Text style={s.label}>Time (e.g. 8:30 AM)</Text>
            <TextInput style={s.input} value={teeTime} onChangeText={setTeeTime} placeholder="8:30 AM" placeholderTextColor={colors.textMuted} accessibilityLabel="Tee time" returnKeyType="next" />

            <Text style={s.label}>Player Count</Text>
            <View style={s.stepperRow}>
              <Pressable style={s.stepperBtn} onPress={() => setPlayerCount(Math.max(1, playerCount - 1))} accessibilityLabel="Decrease player count" accessibilityHint="Remove one player">
                <ChevronDown size={18} color={colors.primary} />
              </Pressable>
              <Text style={s.stepperVal}>{playerCount}</Text>
              <Pressable style={s.stepperBtn} onPress={() => setPlayerCount(Math.min(16, playerCount + 1))} accessibilityLabel="Increase player count" accessibilityHint="Add one player">
                <ChevronUp size={18} color={colors.primary} />
              </Pressable>
            </View>

            <Text style={s.label}>Confirmation # (optional)</Text>
            <TextInput style={s.input} value={confirmNumber} onChangeText={setConfirmNumber} placeholder="e.g. GF-2025-93812" placeholderTextColor={colors.textMuted} accessibilityLabel="Confirmation number" returnKeyType="done" />

            <Pressable
              style={[s.emailCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => { setShowEmailInfo(!showEmailInfo); track('email_import_info_toggled', { open: !showEmailInfo }); }}
              accessibilityLabel="Import from email"
              accessibilityHint="Show your trip email address to forward booking confirmations"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Mail size={18} color={colors.primary} />
                <Text style={s.emailTitle}>Import from Email</Text>
              </View>
              {showEmailInfo ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
            </Pressable>

            {showEmailInfo && (
              <Animated.View entering={FadeInDown.springify()} style={[s.emailCard, { marginTop: 4, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0 }]}>
                <Text style={s.emailBody}>
                  {"Forward your tee time confirmation email to your trip's unique address and we'll parse the details automatically."}
                </Text>
                <Text style={s.emailAddress}>{params.invite_email ?? 'Check your trip settings for the email address.'}</Text>
                <Text style={[s.emailBody, { marginTop: 6 }]}>Parsed tee times will appear here ready to confirm.</Text>
              </Animated.View>
            )}

            <View style={{ height: 32 }} />
          </Animated.View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            accessibilityLabel="Save tee time"
            accessibilityHint="Saves this tee time to your trip itinerary"
          >
            {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={s.saveTxt}>Save Tee Time</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
