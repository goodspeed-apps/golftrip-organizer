import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutLeft } from 'react-native-reanimated';
import { Copy, CheckCircle, Mail, AlertCircle, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { EmailImportCard } from '@/components/EmailImportCard';

type EmailImport = {
  id: string;
  parsed_course_name: string | null;
  parsed_tee_date: string | null;
  parsed_tee_time: string | null;
  parsed_player_count: number | null;
  parsed_confirmation_number: string | null;
  parse_status: string;
  received_at: string;
};

type Trip = { id: string; name: string; invite_email_address: string | null };

export default function EmailImportScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [imports, setImports] = useState<EmailImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const start = Date.now();
    try {
      const end = trackApiLatency('email_import_fetch', start);
      const [tripRes, importsRes] = await Promise.all([
        supabase.from('trips').select('id,name,invite_email_address').eq('id', tripId).single(),
        supabase.from('email_imports').select('*').eq('trip_id', tripId).eq('parse_status', 'parsed').is('tee_time_id', null).order('received_at', { ascending: false }),
      ]);
      end?.();
      if (tripRes.error) throw tripRes.error;
      if (importsRes.error) throw importsRes.error;
      setTrip(tripRes.data as Trip);
      setImports((importsRes.data ?? []) as EmailImport[]);
      setError(null);
      trackScreenLoad('email_import', start);
    } catch (e) {
      captureException(e as Error, { screen: 'email_import', action: 'fetch' });
      setError('Unable to load email import data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    track('screen_view_email_import', { tripId });
    fetchData();
  }, [tripId]);

  const handleCopy = async () => {
    if (!trip?.invite_email_address) return;
    await Clipboard.setStringAsync(trip.invite_email_address);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    track('copy_trip_email', { tripId });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirm = async (item: EmailImport) => {
    if (!user?.id || !tripId) return;
    setConfirming(item.id);
    track('confirm_email_import', { tripId, importId: item.id });
    try {
      const { data: tt, error: ttErr } = await supabase.from('tee_times').insert({
        trip_id: tripId,
        course_name: item.parsed_course_name ?? 'Unknown Course',
        tee_date: item.parsed_tee_date,
        tee_time: item.parsed_tee_time,
        player_count: item.parsed_player_count ?? 0,
        confirmation_number: item.parsed_confirmation_number,
        source: 'email_import',
        created_by: user.id,
      }).select('id').single();
      if (ttErr) throw ttErr;
      await supabase.from('email_imports').update({ tee_time_id: tt.id }).eq('id', item.id);
      setConfirmed(prev => new Set([...prev, item.id]));
      showToast('Tee time added to itinerary!', 'success');
    } catch (e) {
      captureException(e as Error, { screen: 'email_import', action: 'confirm' });
      showToast('Failed to save tee time.', 'error');
    } finally {
      setConfirming(null);
    }
  };

  const handleEdit = (item: EmailImport) => {
    track('edit_email_import', { tripId, importId: item.id });
    router.push({
      pathname: '/(modal)/add-tee-time',
      params: {
        tripId,
        prefillCourse: item.parsed_course_name ?? '',
        prefillDate: item.parsed_tee_date ?? '',
        prefillTime: item.parsed_tee_time ?? '',
        prefillPlayers: String(item.parsed_player_count ?? ''),
        prefillConfirmation: item.parsed_confirmation_number ?? '',
      },
    });
  };

  const pendingImports = imports.filter(i => !confirmed.has(i.id));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={pendingImports}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ padding: 20 }}>
            {/* Header */}
            <Animated.View entering={FadeInDown.delay(0)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Mail size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Email Import</Text>
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(50)} style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 20 }}>
              Forward your GolfNow or TeeOff confirmation emails to the address below and they'll appear here for review.
            </Animated.Text>

            {/* Trip Email Address */}
            {trip?.invite_email_address ? (
              <Animated.View entering={FadeInDown.delay(100)} style={{ backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.borderAccent }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Your Trip Email Address</Text>
                <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.primary, marginBottom: 14, letterSpacing: 0.3 }} numberOfLines={1} adjustsFontSizeToFit>
                  {trip.invite_email_address}
                </Text>
                <Pressable
                  onPress={handleCopy}
                  accessibilityLabel="Copy trip email address"
                  accessibilityHint="Copies the inbound email address to your clipboard"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: copied ? colors.success : colors.primary,
                    borderRadius: 10,
                    paddingVertical: 12,
                    opacity: pressed ? 0.85 : 1,
                    minHeight: 44,
                  })}
                >
                  {copied ? <CheckCircle size={18} color={colors.textOnPrimary} style={{ marginRight: 6 }} /> : <Copy size={18} color={colors.textOnPrimary} style={{ marginRight: 6 }} />}
                  <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textOnPrimary }}>
                    {copied ? 'Copied!' : 'Copy Email Address'}
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}

            {/* How it works */}
            <Animated.View entering={FadeInDown.delay(150)} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontWeight: '600', marginBottom: 10 }}>How It Works</Text>
              {[
                { step: '1', label: 'Book your tee time on GolfNow or TeeOff' },
                { step: '2', label: 'Forward the confirmation email to your trip address' },
                { step: '3', label: 'Review the auto-parsed details and confirm below' },
              ].map((s, i) => (
                <View key={s.step} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i < 2 ? 8 : 0 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.primary, fontWeight: '700' }}>{s.step}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.text }}>{s.label}</Text>
                </View>
              ))}
            </Animated.View>

            {error ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.negativeMuted, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <AlertCircle size={18} color={colors.error} style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.error }}>{error}</Text>
              </View>
            ) : null}

            {pendingImports.length > 0 ? (
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 10 }}>
                Pending Review ({pendingImports.length})
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(200 + index * 50)} exiting={FadeOutLeft} style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <EmailImportCard
              item={item}
              confirming={confirming === item.id}
              onConfirm={() => handleConfirm(item)}
              onEdit={() => handleEdit(item)}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          !error ? (
            <View style={{ paddingHorizontal: 20 }}>
              <EmptyState
                icon="mail"
                title="No confirmations yet"
                description={"Forward a GolfNow or TeeOff booking email to your trip address and it'll show up here."}
              />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}
