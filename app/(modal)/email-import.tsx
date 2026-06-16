import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutRight } from 'react-native-reanimated';
import { Copy, CheckCircle, Mail, ChevronRight, AlertCircle } from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ImportEntryCard } from '@/components/ImportEntryCard';

type ParseStatus = 'awaiting_email' | 'parsing' | 'parsed_preview' | 'confirmed' | 'parse_failed_manual_fallback';

interface EmailImport {
  id: string;
  parsed_course_name: string | null;
  parsed_tee_date: string | null;
  parsed_tee_time: string | null;
  parsed_player_count: number | null;
  parsed_confirmation_number: string | null;
  parse_status: ParseStatus;
  sender_email: string | null;
  received_at: string;
  tee_time_id: string | null;
}

export default function EmailImportScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { showToast } = useToast();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [tripEmail, setTripEmail] = useState<string>('');
  const [imports, setImports] = useState<EmailImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const start = Date.now();
    try {
      const endTripApi = trackApiLatency('get_trip_email');
      const tripRes = await supabase
        .from('trips')
        .select('invite_email_address')
        .eq('id', tripId)
        .single();
      endTripApi();

      const endImportsApi = trackApiLatency('get_email_imports');
      const importsRes = await supabase
        .from('email_imports')
        .select('*')
        .eq('trip_id', tripId)
        .neq('parse_status', 'confirmed')
        .order('received_at', { ascending: false });
      endImportsApi();

      if (tripRes.error) throw tripRes.error;
      if (importsRes.error) throw importsRes.error;
      setTripEmail(tripRes.data?.invite_email_address ?? '');
      setImports((importsRes.data ?? []) as EmailImport[]);
      trackScreenLoad('email_import', start);
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'fetchData' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { track('screen_view_email_import', { trip_id: tripId }); fetchData(); }, [tripId]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(tripEmail);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    track('copy_trip_email', { trip_id: tripId });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirm = async (item: EmailImport) => {
    if (!tripId) return;
    try {
      const { error: ttErr, data: ttData } = await supabase.from('tee_times').insert({
        trip_id: tripId,
        course_name: item.parsed_course_name ?? 'Unknown Course',
        tee_date: item.parsed_tee_date,
        tee_time: item.parsed_tee_time,
        player_count: item.parsed_player_count ?? 0,
        confirmation_number: item.parsed_confirmation_number,
      }).select('id').single();

      if (ttErr) throw ttErr;

      const { error: updateErr } = await supabase
        .from('email_imports')
        .update({ parse_status: 'confirmed', tee_time_id: ttData?.id })
        .eq('id', item.id);

      if (updateErr) throw updateErr;

      setConfirmedIds(prev => new Set([...prev, item.id]));
      setImports(prev => prev.filter(i => i.id !== item.id));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track('email_import_confirmed', { import_id: item.id, trip_id: tripId });
      showToast('Tee time added to your trip!', 'success');
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleConfirm' });
      showToast('Failed to confirm tee time', 'error');
    }
  };

  const handleDismiss = async (item: EmailImport) => {
    try {
      const { error } = await supabase
        .from('email_imports')
        .update({ parse_status: 'confirmed' })
        .eq('id', item.id);
      if (error) throw error;
      setImports(prev => prev.filter(i => i.id !== item.id));
      track('email_import_dismissed', { import_id: item.id, trip_id: tripId });
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleDismiss' });
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const pendingImports = imports.filter(i => !confirmedIds.has(i.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: 24 }}>
          <Text style={{
            fontFamily: 'Manrope_700Bold',
            fontSize: 24,
            color: colors.text,
            marginBottom: 8,
          }}>
            Email Import
          </Text>
          <Text style={{
            fontFamily: 'Manrope_400Regular',
            fontSize: 15,
            color: colors.textSecondary,
          }}>
            Forward confirmation emails to auto-import tee times.
          </Text>
        </Animated.View>

        {/* Trip Email Address */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(50)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Mail size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={{
              fontFamily: 'Manrope_600SemiBold',
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              Your Trip's Import Email
            </Text>
          </View>

          <Text style={{
            fontFamily: 'Manrope_600SemiBold',
            fontSize: 15,
            color: colors.text,
            marginBottom: 12,
          }}>
            {tripEmail || 'Loading…'}
          </Text>

          <Pressable
            onPress={handleCopy}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: copied ? colors.success + '20' : colors.primary + '15',
              borderRadius: 10,
              padding: 10,
              alignSelf: 'flex-start',
            }}
          >
            {copied ? (
              <CheckCircle size={16} color={colors.success} style={{ marginRight: 6 }} />
            ) : (
              <Copy size={16} color={colors.primary} style={{ marginRight: 6 }} />
            )}
            <Text style={{
              fontFamily: 'Manrope_600SemiBold',
              fontSize: 13,
              color: copied ? colors.success : colors.primary,
            }}>
              {copied ? 'Copied!' : 'Copy Email'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Imports List */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)}>
          <Text style={{
            fontFamily: 'Manrope_700Bold',
            fontSize: 18,
            color: colors.text,
            marginBottom: 12,
          }}>
            Pending Imports
          </Text>

          {loading ? (
            <>
              <LoadingSkeleton height={100} style={{ marginBottom: 12 }} />
              <LoadingSkeleton height={100} style={{ marginBottom: 12 }} />
            </>
          ) : pendingImports.length === 0 ? (
            <EmptyState
              icon={<Mail size={40} color={colors.textMuted} />}
              title="No pending imports"
              subtitle="Forward a confirmation email to your trip address to get started."
            />
          ) : (
            pendingImports.map((item, index) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.duration(300).delay(index * 50)}
                exiting={FadeOutRight.duration(200)}
              >
                <ImportEntryCard
                  item={item}
                  onConfirm={() => handleConfirm(item)}
                  onDismiss={() => handleDismiss(item)}
                />
              </Animated.View>
            ))
          )}
        </Animated.View>

        {/* Info box */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(150)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            marginTop: 24,
            flexDirection: 'row',
            alignItems: 'flex-start',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AlertCircle size={16} color={colors.textMuted} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={{
            flex: 1,
            fontFamily: 'Manrope_400Regular',
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 20,
          }}>
            Supported providers: GolfNow, TeeOff, Chronogolf, and more. Parsing may take a few minutes after the email arrives.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
