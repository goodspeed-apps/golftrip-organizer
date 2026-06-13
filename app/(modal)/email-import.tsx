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
  const { colors } = useThemeColors();
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
      const endTripLatency = trackApiLatency('get_trip_email');
      const tripRes = await supabase
        .from('trips')
        .select('invite_email_address')
        .eq('id', tripId)
        .single();
      endTripLatency();

      const endImportsLatency = trackApiLatency('get_email_imports');
      const importsRes = await supabase
        .from('email_imports')
        .select('*')
        .eq('trip_id', tripId)
        .neq('parse_status', 'confirmed')
        .order('received_at', { ascending: false });
      endImportsLatency();

      if (tripRes.error) throw tripRes.error;
      if (importsRes.error) throw importsRes.error;
      setTripEmail(tripRes.data?.invite_email_address ?? '');
      setImports(importsRes.data ?? []);
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
        player_count: item.parsed_player_count,
        confirmation_number: item.parsed_confirmation_number,
      }).select().single();
      if (ttErr) throw ttErr;

      const { error: updateErr } = await supabase
        .from('email_imports')
        .update({ parse_status: 'confirmed', tee_time_id: ttData?.id })
        .eq('id', item.id);
      if (updateErr) throw updateErr;

      setConfirmedIds((prev) => new Set([...prev, item.id]));
      setImports((prev) => prev.filter((i) => i.id !== item.id));
      showToast({ type: 'success', message: 'Tee time confirmed!' });
      track('email_import_confirmed', { trip_id: tripId, import_id: item.id });
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleConfirm' });
      showToast({ type: 'error', message: 'Failed to confirm tee time.' });
    }
  };

  const handleDismiss = async (item: EmailImport) => {
    try {
      const { error } = await supabase
        .from('email_imports')
        .update({ parse_status: 'confirmed' })
        .eq('id', item.id);
      if (error) throw error;
      setImports((prev) => prev.filter((i) => i.id !== item.id));
      track('email_import_dismissed', { trip_id: tripId, import_id: item.id });
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleDismiss' });
    }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ChevronRight size={24} color={colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 }}>Email Import</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Trip Email Address Card */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Mail size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Your Trip Email</Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
            Forward tee time confirmation emails to this address and they'll appear here automatically.
          </Text>
          {tripEmail ? (
            <Pressable
              onPress={handleCopy}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12 }}
            >
              <Text style={{ flex: 1, fontSize: 14, color: colors.primary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                {tripEmail}
              </Text>
              {copied
                ? <CheckCircle size={18} color={colors.success ?? '#22c55e'} />
                : <Copy size={18} color={colors.textSecondary} />
              }
            </Pressable>
          ) : (
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>No email address assigned.</Text>
          )}
        </View>

        {/* Pending Imports */}
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
          Pending Imports {imports.length > 0 ? `(${imports.length})` : ''}
        </Text>

        {loading ? (
          <LoadingSkeleton variant="card" count={2} />
        ) : imports.length === 0 ? (
          <EmptyState
            title="No pending imports"
            description="Forwarded emails will appear here for review."
          />
        ) : (
          imports.map((item) => (
            <Animated.View key={item.id} entering={FadeInDown} exiting={FadeOutRight}>
              <ImportEntryCard
                item={item}
                onConfirm={() => handleConfirm(item)}
                onDismiss={() => handleDismiss(item)}
              />
            </Animated.View>
          ))
        )}

        {/* Info box */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 14, marginTop: 20, alignItems: 'flex-start' }}>
          <AlertCircle size={16} color={colors.textSecondary} style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            Emails are parsed automatically. Always review parsed details before confirming.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
