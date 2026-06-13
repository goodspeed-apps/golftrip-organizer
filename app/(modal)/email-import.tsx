import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Copy, CheckCircle, Mail, AlertTriangle } from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';
import { EmailImportCard } from '@/components/EmailImportCard';

interface EmailImport {
  id: string;
  parsed_course_name: string | null;
  parsed_tee_date: string | null;
  parsed_tee_time: string | null;
  parsed_player_count: number | null;
  parsed_confirmation_number: string | null;
  parse_status: string;
  received_at: string;
}

export default function EmailImportScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { tripId, tripName, inviteEmail } = useLocalSearchParams<{ tripId: string; tripName: string; inviteEmail: string }>();
  const { showToast } = useToast();
  const [imports, setImports] = useState<EmailImport[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchImports = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const start = Date.now();
    try {
      const end = trackApiLatency('email_imports_fetch', start);
      const { data, error: err } = await supabase
        .from('email_imports')
        .select('id,parsed_course_name,parsed_tee_date,parsed_tee_time,parsed_player_count,parsed_confirmation_number,parse_status,received_at')
        .eq('trip_id', tripId)
        .eq('parse_status', 'parsed')
        .is('tee_time_id', null)
        .order('received_at', { ascending: false });
      end?.();
      if (err) throw err;
      setImports(data ?? []);
      setError(null);
      trackScreenLoad('email_import', start);
    } catch (e) {
      captureException(e as Error, { screen: 'email_import', action: 'fetch_imports' });
      setError("Couldn't load parsed emails.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    track('screen_view_email_import', { tripId });
    fetchImports();
  }, [tripId]);

  const handleCopy = async () => {
    if (!inviteEmail) return;
    await Clipboard.setStringAsync(inviteEmail);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    showToast('Email address copied!', 'success');
    track('copy_trip_email', { tripId });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirm = async (item: EmailImport) => {
    if (!user?.id || !tripId) return;
    track('confirm_parsed_tee_time', { tripId, importId: item.id });
    try {
      const { data: tt, error: ttErr } = await supabase.from('tee_times').insert({
        trip_id: tripId,
        course_name: item.parsed_course_name ?? 'Unknown Course',
        tee_date: item.parsed_tee_date,
        tee_time: item.parsed_tee_time,
        player_count: item.parsed_player_count ?? 1,
        confirmation_number: item.parsed_confirmation_number,
        source: 'email_import',
        created_by: user.id,
      }).select('id').single();
      if (ttErr) throw ttErr;
      await supabase.from('email_imports').update({ tee_time_id: tt.id }).eq('id', item.id);
      setConfirmed(prev => new Set([...prev, item.id]));
      setTimeout(() => setImports(prev => prev.filter(i => i.id !== item.id)), 700);
      showToast('Tee time added to itinerary!', 'success');
    } catch (e) {
      captureException(e as Error, { screen: 'email_import', action: 'confirm_tee_time' });
      showToast("Couldn't save tee time.", 'error');
    }
  };

  const handleEdit = (item: EmailImport) => {
    track('edit_parsed_tee_time', { tripId, importId: item.id });
    router.push({
      pathname: '/(modal)/add-tee-time',
      params: {
        tripId,
        prefillCourse: item.parsed_course_name ?? '',
        prefillDate: item.parsed_tee_date ?? '',
        prefillTime: item.parsed_tee_time ?? '',
        prefillPlayers: String(item.parsed_player_count ?? ''),
        prefillConfirmation: item.parsed_confirmation_number ?? '',
        importId: item.id,
      },
    });
  };

  const emailAddr = inviteEmail ?? `${(tripName ?? 'trip').toLowerCase().replace(/\s+/g, '-')}-abc123@golftrip.app`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: colors.text }}>Email Import</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" accessibilityHint="Dismisses email import modal" style={{ padding: 8 }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.primary }}>Done</Text>
          </Pressable>
        </View>

        <FlatList
          data={imports}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchImports(); }} tintColor={colors.primary} />}
          ListHeaderComponent={() => (
            <View style={{ padding: 20, gap: 16 }}>
              {/* Email Address Card */}
              <Animated.View entering={FadeInDown.delay(50).duration(350)} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.borderAccent, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Mail size={20} color={colors.primary} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text }}>Your Trip's Import Email</Text>
                </View>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.primary, letterSpacing: 0.3 }}>{emailAddr}</Text>
                <Pressable
                  onPress={handleCopy}
                  accessibilityLabel="Copy email address"
                  accessibilityHint="Copies the trip import email address to your clipboard"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: copied ? colors.success : colors.primary, borderRadius: 12, paddingVertical: 12, opacity: pressed ? 0.85 : 1 })}
                >
                  {copied ? <CheckCircle size={18} color={colors.textOnPrimary} /> : <Copy size={18} color={colors.textOnPrimary} />}
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textOnPrimary }}>{copied ? 'Copied!' : 'Copy Email Address'}</Text>
                </Pressable>
              </Animated.View>

              {/* How It Works */}
              <Animated.View entering={FadeInDown.delay(100).duration(350)} style={{ backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 16, gap: 10 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text }}>How It Works</Text>
                {[
                  { step: '1', text: 'Copy the email address above' },
                  { step: '2', text: 'Forward your GolfNow or TeeOff confirmation email to it' },
                  { step: '3', text: 'We parse it and show a preview below for you to confirm' },
                ].map(({ step, text }) => (
                  <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.primary }}>{step}</Text>
                    </View>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, flex: 1 }}>{text}</Text>
                  </View>
                ))}
              </Animated.View>

              {imports.length > 0 && (
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text, marginTop: 4 }}>
                  Pending Review ({imports.length})
                </Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            loading ? (
              <View style={{ paddingHorizontal: 20, gap: 12 }}>
                <LoadingSkeleton variant="card" />
                <LoadingSkeleton variant="card" />
              </View>
            ) : error ? (
              <View style={{ paddingHorizontal: 20 }}>
                <Animated.View entering={FadeInDown.duration(300)} style={{ backgroundColor: colors.surfaceElevated, borderRadius: 16, padding: 20, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border }}>
                  <AlertTriangle size={28} color={colors.warning} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text }}>{error}</Text>
                  <Pressable onPress={fetchImports} accessibilityLabel="Retry loading" style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textOnPrimary }}>Retry</Text>
                  </Pressable>
                </Animated.View>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 20 }}>
                <EmptyState icon="mail" title="Awaiting Your First Email" description="Forward a GolfNow or TeeOff confirmation email to the address above and it'll appear here for review." />
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(50 * index).duration(350)} style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <EmailImportCard
                item={item}
                isConfirmed={confirmed.has(item.id)}
                onConfirm={() => handleConfirm(item)}
                onEdit={() => handleEdit(item)}
              />
            </Animated.View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </Animated.View>
    </SafeAreaView>
  );
}
