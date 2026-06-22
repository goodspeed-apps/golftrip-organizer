import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, FlatList, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { MapPin, Calendar, Users, DollarSign, MessageCircle, Check, X, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';

type Trip = { id: string; name: string; start_date: string; end_date: string; cover_image_url: string | null; organizer_id: string };
type TeeTime = { id: string; course_name: string; tee_date: string; tee_time: string; course_city: string };
type Expense = { id: string; description: string; amount_cents: number; category: string };
type Message = { id: string; guest_name: string | null; body: string; created_at: string };
type Tab = 'itinerary' | 'expenses' | 'chat';

export default function GuestTripView() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { showToast } = useToast();
  const startTime = useRef(Date.now());

  const [trip, setTrip] = useState<Trip | null>(null);
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('itinerary');
  const [rsvpStatus, setRsvpStatus] = useState<'none' | 'going' | 'declined'>('none');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [guestName, setGuestName] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const rsvpScale = useSharedValue(1);
  const rsvpStyle = useAnimatedStyle(() => ({ transform: [{ scale: rsvpScale.value }] }));

  const fetchData = useCallback(async () => {
    if (!code) { setLoading(false); return; }
    const end = trackApiLatency('guest_trip_fetch');
    try {
      const { data: tripData, error: tripErr } = await supabase
        .from('trips').select('id,name,start_date,end_date,cover_image_url,organizer_id').eq('invite_code', code).single();
      if (tripErr || !tripData) throw tripErr ?? new Error('Trip not found');
      setTrip(tripData);
      const [ttRes, exRes, msgRes] = await Promise.all([
        supabase.from('tee_times').select('id,course_name,tee_date,tee_time,course_city').eq('trip_id', tripData.id).order('tee_date'),
        supabase.from('expenses').select('id,description,amount_cents,category').eq('trip_id', tripData.id),
        supabase.from('messages').select('id,guest_name,body,created_at').eq('trip_id', tripData.id).eq('is_deleted', false).order('created_at'),
      ]);
      if (ttRes.data) setTeeTimes(ttRes.data);
      if (exRes.data) setExpenses(exRes.data);
      if (msgRes.data) setMessages(msgRes.data);
      trackScreenLoad('GuestTripView', startTime.current);
    } catch (e) {
      const err = e as Error;
      captureException(err, { screen: 'GuestTripView', action: 'fetchData' });
      setError(err.message ?? 'Could not load trip');
    } finally {
      setLoading(false);
      setRefreshing(false);
      end();
    }
  }, [code]);

  useEffect(() => { track('screen_view_guest_trip', { code }); fetchData(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const handleRSVP = useCallback(async (status: 'going' | 'declined') => {
    rsvpScale.value = withSpring(0.92, {}, () => { rsvpScale.value = withSpring(1); });
    track('guest_rsvp', { status, code });
    if (!trip) return;
    const name = guestName || 'Guest';
    const { error: err } = await supabase.from('trip_members').upsert(
      { trip_id: trip.id, guest_name: name, rsvp_status: status, role: 'guest' },
      { onConflict: 'trip_id,guest_name' }
    );
    if (err) { captureException(err, { screen: 'GuestTripView', action: 'handleRSVP' }); return; }
    setRsvpStatus(status);
    showToast(status === 'going' ? "You're in! 🎉" : "Got it, maybe next time.", 'success');
  }, [trip, guestName, rsvpScale, track, code, showToast]);

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || !trip) return;
    if (!guestName.trim()) { setShowNameModal(true); return; }
    track('guest_send_message', { code });
    const { data, error: err } = await supabase.from('messages').insert({
      trip_id: trip.id, guest_name: guestName, body: chatInput.trim(), is_announcement: false, is_deleted: false,
    }).select().single();
    if (err) { captureException(err, { screen: 'GuestTripView', action: 'sendMessage' }); return; }
    if (data) setMessages(prev => [...prev, data as Message]);
    setChatInput('');
  }, [chatInput, trip, guestName, track, code]);

  const totalCents = expenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
  const s = (v: number) => `$${(v / 100).toFixed(2)}`;
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="card" count={4} /></SafeAreaView>;
  if (error || !trip) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState icon="alert-circle" title="Trip not found" subtitle={error ?? 'Check your invite link and try again.'} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {!bannerDismissed && (
          <Animated.View entering={FadeInDown.delay(100)} style={{ backgroundColor: colors.primaryMuted, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{"Create a free account to manage this trip and more."}</Text>
            <Pressable onPress={() => { track('guest_create_account_tap', { code }); router.push({ pathname: '/(auth)/signup', params: { tripCode: code } }); }} accessibilityLabel="Create account" accessibilityHint="Opens sign up flow" hitSlop={8}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Sign up</Text>
            </Pressable>
            <Pressable onPress={() => setBannerDismissed(true)} accessibilityLabel="Dismiss banner" hitSlop={8}><X size={16} color={colors.textSecondary} /></Pressable>
          </Animated.View>
        )}

        <FlatList
          data={activeTab === 'itinerary' ? teeTimes : activeTab === 'expenses' ? expenses : messages}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View>
              <Animated.View entering={FadeInDown.delay(50)} style={{ backgroundColor: colors.surface, margin: 16, borderRadius: 16, padding: 20, shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
                <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{trip.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Calendar size={14} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{fmt(trip.start_date)}-{fmt(trip.end_date)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  {rsvpStatus === 'none' ? (
                    <>
                      <Animated.View style={[{ flex: 1 }, rsvpStyle]}>
                        <Pressable onPress={() => handleRSVP('going')} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }} accessibilityLabel="RSVP Coming" accessibilityHint="Mark yourself as attending this trip">
                          <Text style={{ color: colors.textOnPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>{"I'm Coming"}</Text>
                        </Pressable>
                      </Animated.View>
                      <Pressable onPress={() => handleRSVP('declined')} style={{ flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }} accessibilityLabel="Can't make it" accessibilityHint="Decline this trip invitation">
                        <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>{"Can't Make It"}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: rsvpStatus === 'going' ? colors.positiveMuted : colors.warningMuted, borderRadius: 12, paddingVertical: 12 }}>
                      <Check size={18} color={rsvpStatus === 'going' ? colors.positive : colors.warning} />
                      <Text style={{ color: rsvpStatus === 'going' ? colors.positive : colors.warning, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>{rsvpStatus === 'going' ? "You're in!" : 'Maybe next time'}</Text>
                    </View>
                  )}
                </View>
              </Animated.View>

              <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 4 }}>
                {(['itinerary', 'expenses', 'chat'] as Tab[]).map(tab => (
                  <Pressable key={tab} onPress={() => { setActiveTab(tab); track('guest_tab_tap', { tab, code }); }} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, backgroundColor: activeTab === tab ? colors.surface : 'transparent' }} accessibilityLabel={`${tab} tab`} accessibilityHint={`Switch to ${tab} view`}>
                    <Text style={{ color: activeTab === tab ? colors.primary : colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 13, textTransform: 'capitalize' }}>{tab}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(50 * index)}>
              {activeTab === 'itinerary' && (() => { const t = item as TeeTime; return (
                <View style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.card, borderRadius: 14, padding: 16, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text }}>{t.course_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MapPin size={12} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{t.course_city}</Text></View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Calendar size={12} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{fmt(t.tee_date)} at {t.tee_time}</Text></View>
                  </View>
                </View>
              ); })()}
              {activeTab === 'expenses' && (() => { const e = item as Expense; return (
                <View style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.card, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View><Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text }}>{e.description}</Text><Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 }}>{e.category}</Text></View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text }}>{s(e.amount_cents ?? 0)}</Text>
                </View>
              ); })()}
              {activeTab === 'chat' && (() => { const m = item as Message; return (
                <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 14, padding: 14 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary }}>{m.guest_name ?? 'Guest'}</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4 }}>{m.body}</Text>
                </View>
              ); })()}
            </Animated.View>
          )}
          ListFooterComponent={
            <>
              {activeTab === 'expenses' && expenses.length > 0 && (
                <View style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 16, backgroundColor: colors.primaryMuted, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text }}>Total</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.primary }}>{s(totalCents)}</Text>
                </View>
              )}
              {activeTab === 'itinerary' && teeTimes.length === 0 && <EmptyState icon="calendar" title="No tee times yet" subtitle="The organizer will add tee times soon." />}
              {activeTab === 'expenses' && expenses.length === 0 && <EmptyState icon="dollar-sign" title="No expenses yet" subtitle="Expenses will appear here once added." />}
              {activeTab === 'chat' && messages.length === 0 && <EmptyState icon="message-circle" title="No messages yet" subtitle="Be the first to say something!" />}
              {activeTab === 'chat' && (
                <View style={{ marginHorizontal: 16, marginBottom: 24, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Say something..." placeholderTextColor={colors.textMuted} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 14, borderWidth: 1, borderColor: colors.border }} accessibilityLabel="Chat message input" />
                  <Pressable onPress={sendMessage} style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 12 }} accessibilityLabel="Send message" accessibilityHint="Send your message to the trip group"><ChevronRight size={20} color={colors.textOnPrimary} /></Pressable>
                </View>
              )}
              <Pressable onPress={() => { track('guest_join_member_tap', { code }); router.push({ pathname: '/(auth)/signup', params: { tripCode: code } }); }} style={{ marginHorizontal: 16, marginBottom: 32, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }} accessibilityLabel="Join as full member" accessibilityHint="Create an account to join this trip as a full member">
                <Users size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Join as a Member</Text>
              </Pressable>
            </>
          }
        />

        <Modal visible={showNameModal} transparent animationType="slide" onRequestClose={() => setShowNameModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.shadow + '80' }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text, marginBottom: 6 }}>{"What's your name?"}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 16 }}>So the group knows who you are.</Text>
              <TextInput value={guestName} onChangeText={setGuestName} placeholder="Your name" placeholderTextColor={colors.textMuted} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }} autoFocus />
              <Pressable onPress={() => { if (!guestName.trim()) return; setShowNameModal(false); sendMessage(); }} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }} accessibilityLabel="Confirm name and send" accessibilityHint="Save your name and send the message">
                <Text style={{ color: colors.textOnPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Send Message</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
