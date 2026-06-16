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
        player_count: item.parsed_player_count,
        confirmation_number: item.parsed_confirmation_number,
      }).select('id').single();
      if (ttErr) throw ttErr;

      await supabase.from('email_imports').update({
        parse_status: 'confirmed',
        tee_time_id: ttData.id,
      }).eq('id', item.id);

      setConfirmedIds(prev => new Set([...prev, item.id]));
      setImports(prev => prev.filter(i => i.id !== item.id));
      showToast('Tee time confirmed!', 'success');
      track('email_import_confirmed', { import_id: item.id, trip_id: tripId });
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleConfirm' });
      showToast('Could not confirm tee time. Try again.', 'error');
    }
  };

  const handleDismiss = async (item: EmailImport) => {
    try {
      await supabase.from('email_imports').update({ parse_status: 'parse_failed_manual_fallback' }).eq('id', item.id);
      setImports(prev => prev.filter(i => i.id !== item.id));
      track('email_import_dismissed', { import_id: item.id, trip_id: tripId });
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleDismiss' });
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.colors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.colors.text, fontFamily: 'Manrope_700Bold' }}>Email Import</Text>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ color: colors.colors.primary, fontSize: 16 }}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.colors.primary} />}
      >
        {/* Trip Email Address Card */}
        <Animated.View entering={FadeInDown.delay(0).duration(350)}>
          <View style={{ backgroundColor: colors.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Mail size={18} color={colors.colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.colors.text, fontFamily: 'Manrope_600SemiBold' }}>Forward Confirmation Emails To</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.colors.textSecondary, marginBottom: 12, fontFamily: 'Manrope_400Regular' }}>
              Forward your tee time confirmation emails to this address and we'll parse them automatically.
            </Text>
            <Pressable
              onPress={handleCopy}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.colors.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.colors.border }}
            >
              <Text style={{ flex: 1, fontSize: 13, color: colors.colors.primary, fontFamily: 'Manrope_500Medium' }} numberOfLines={1}>
                {tripEmail || 'Loading…'}
              </Text>
              {copied
                ? <CheckCircle size={18} color={colors.colors.success} />
                : <Copy size={18} color={colors.colors.primary} />
              }
            </Pressable>
          </View>
        </Animated.View>

        {/* Imports List */}
        {imports.length === 0 ? (
          <EmptyState
            icon={<Mail size={40} color={colors.colors.textSecondary} />}
            title="No pending imports"
            subtitle="Forward a tee time confirmation email to the address above."
          />
        ) : (
          imports.map((item, index) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(index * 60).duration(350)} exiting={FadeOutRight.duration(300)}>
              <ImportEntryCard
                item={item}
                onConfirm={() => handleConfirm(item)}
                onDismiss={() => handleDismiss(item)}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
