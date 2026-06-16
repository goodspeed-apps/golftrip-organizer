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
      const endTripEmail = trackApiLatency('get_trip_email');
      const tripRes = await supabase
        .from('trips')
        .select('invite_email_address')
        .eq('id', tripId)
        .single();
      endTripEmail();

      const endImports = trackApiLatency('get_email_imports');
      const importsRes = await supabase
        .from('email_imports')
        .select('*')
        .eq('trip_id', tripId)
        .neq('parse_status', 'confirmed')
        .order('received_at', { ascending: false });
      endImports();

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
      }).select().single();

      if (ttErr) throw ttErr;

      await supabase
        .from('email_imports')
        .update({ parse_status: 'confirmed', tee_time_id: ttData?.id })
        .eq('id', item.id);

      setConfirmedIds(prev => new Set([...prev, item.id]));
      setImports(prev => prev.filter(i => i.id !== item.id));
      track('email_import_confirmed', { trip_id: tripId, import_id: item.id });
      showToast('Tee time added!', 'success');
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleConfirm' });
      showToast('Failed to confirm import', 'error');
    }
  };

  const handleDismiss = async (item: EmailImport) => {
    try {
      await supabase
        .from('email_imports')
        .update({ parse_status: 'confirmed' })
        .eq('id', item.id);
      setImports(prev => prev.filter(i => i.id !== item.id));
      track('email_import_dismissed', { trip_id: tripId, import_id: item.id });
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleDismiss' });
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>Back</Text>
          </Pressable>
          <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 20, color: colors.text, flex: 1 }}>
            Email Import
          </Text>
        </View>

        {/* Trip email address */}
        <Animated.View entering={FadeInDown.delay(50)}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Mail size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: colors.text }}>
                Forward Confirmations To
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text
                style={{
                  fontFamily: 'Manrope_400Regular',
                  fontSize: 13,
                  color: colors.textSecondary,
                  flex: 1,
                  marginRight: 8,
                }}
                numberOfLines={1}
              >
                {tripEmail || 'Loading…'}
              </Text>
              <Pressable onPress={handleCopy} style={{ padding: 4 }}>
                {copied ? (
                  <CheckCircle size={20} color={colors.success ?? colors.primary} />
                ) : (
                  <Copy size={20} color={colors.primary} />
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Imports list */}
        {imports.length === 0 ? (
          <EmptyState
            icon={Mail as React.ComponentType<{ size: number; color: string }>}
            title="No pending imports"
            subtitle="Forward a tee time confirmation email to the address above and it will appear here."
          />
        ) : (
          imports.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.delay(index * 60)}
              exiting={FadeOutRight}
            >
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
