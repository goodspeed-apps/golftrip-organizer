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
import { trackScreenLoad } from '@/lib/performance';
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
      const [tripRes, importsRes] = await Promise.all([
        supabase.from('trips').select('invite_email_address').eq('id', tripId).single(),
        supabase
          .from('email_imports')
          .select('*')
          .eq('trip_id', tripId)
          .neq('parse_status', 'confirmed')
          .order('received_at', { ascending: false }),
      ]);
      if (tripRes.error) throw tripRes.error;
      if (importsRes.error) throw importsRes.error;
      setTripEmail((tripRes.data as { invite_email_address?: string } | null)?.invite_email_address ?? '');
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
        player_count: item.parsed_player_count ?? 0,
        confirmation_number: item.parsed_confirmation_number,
        source: 'email_import',
        import_raw: item.id,
      }).select().single();
      if (ttErr) throw ttErr;
      await supabase.from('email_imports').update({ parse_status: 'confirmed', tee_time_id: ttData.id }).eq('id', item.id);
      setConfirmedIds(prev => new Set([...prev, item.id]));
      track('confirm_email_import', { trip_id: tripId, import_id: item.id });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setImports(prev => prev.filter(i => i.id !== item.id)), 800);
    } catch (err) {
      captureException(err as Error, { screen: 'email_import', action: 'handleConfirm' });
      Alert.alert('Error', "Couldn't save tee time. Please try again.");
    }
  };

  const handleEdit = (item: EmailImport) => {
    track('edit_email_import', { import_id: item.id });
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

  const pendingImports = imports.filter(i => i.parse_status === 'parsed_preview' || i.parse_status === 'parse_failed_manual_fallback');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.text, marginBottom: 4 }}>
            Import via Email
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary }}>
            Forward your GolfNow or TeeOff confirmation to this address, we'll parse it automatically.
          </Text>
        </Animated.View>

        {/* Trip Email Card */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={{
          marginHorizontal: 20, borderRadius: 16, backgroundColor: colors.surface,
          borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Mail size={18} color={colors.primary} />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary, marginLeft: 8 }}>
              YOUR TRIP IMPORT ADDRESS
            </Text>
          </View>
          {loading ? (
            <LoadingSkeleton width="100%" height={20} />
          ) : (
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.primary, marginBottom: 16, letterSpacing: 0.2 }}>
              {tripEmail || 'Not available'}
            </Text>
          )}
          <Pressable
            onPress={handleCopy}
            accessibilityLabel="Copy import email address"
            accessibilityHint="Copies the trip import email to your clipboard"
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: copied ? colors.success : colors.primary,
              borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            {copied
              ? <CheckCircle size={16} color={colors.textOnPrimary} />
              : <Copy size={16} color={colors.textOnPrimary} />
            }
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textOnPrimary, marginLeft: 8 }}>
              {copied ? 'Copied!' : 'Copy Address'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Imports List */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Pending Imports ({pendingImports.length})
          </Text>

          {loading ? (
            <>
              <LoadingSkeleton width="100%" height={80} style={{ marginBottom: 10 }} />
              <LoadingSkeleton width="100%" height={80} style={{ marginBottom: 10 }} />
            </>
          ) : pendingImports.length === 0 ? (
            <EmptyState
              icon={<Mail size={36} color={colors.textMuted} />}
              title="No pending imports"
              description="Forward a booking confirmation email to the address above and it will appear here."
            />
          ) : (
            pendingImports.map((item) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.duration(300)}
                exiting={FadeOutRight.duration(300)}
                style={{ marginBottom: 12 }}
              >
                <ImportEntryCard
                  item={item}
                  isConfirmed={confirmedIds.has(item.id)}
                  onConfirm={() => handleConfirm(item)}
                  onEdit={() => handleEdit(item)}
                />
              </Animated.View>
            ))
          )}
        </Animated.View>

        {/* How it works */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{
          marginHorizontal: 20, marginTop: 8, borderRadius: 16,
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20,
        }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text, marginBottom: 12 }}>
            How it works
          </Text>
          {[
            { icon: <Mail size={16} color={colors.primary} />, text: 'Forward your booking confirmation email to the address above' },
            { icon: <AlertCircle size={16} color={colors.primary} />, text: "We'll automatically parse the course, date, time, and player count" },
            { icon: <CheckCircle size={16} color={colors.success} />, text: 'Review and confirm to add it to your itinerary' },
          ].map(({ icon, text }, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i < 2 ? 10 : 0 }}>
              {icon}
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, flex: 1 }}>{text}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
