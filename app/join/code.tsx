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
      setTrip(tripData as Trip);
      const [ttRes, exRes, msgRes] = await Promise.all([
        supabase.from('tee_times').select('id,course_name,tee_date,tee_time,course_city').eq('trip_id', tripData.id).order('tee_date'),
        supabase.from('expenses').select('id,description,amount_cents,category').eq('trip_id', tripData.id),
        supabase.from('messages').select('id,guest_name,body,created_at').eq('trip_id', tripData.id).eq('is_deleted', false).order('created_at'),
      ]);
      if (ttRes.data) setTeeTimes(ttRes.data as TeeTime[]);
      if (exRes.data) setExpenses(exRes.data as Expense[]);
      if (msgRes.data) setMessages(msgRes.data as Message[]);
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

  useEffect(() => {
    track('screen_view_guest_trip', { code });
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const handleRsvp = async (status: 'going' | 'declined') => {
    rsvpScale.value = withSpring(0.95, {}, () => { rsvpScale.value = withSpring(1); });
    setRsvpStatus(status);
    track('guest_rsvp', { status, trip_id: trip?.id });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !trip) return;
    if (!guestName.trim()) { setShowNameModal(true); return; }
    try {
      const { error: msgErr } = await supabase.from('messages').insert({
        trip_id: trip.id,
        guest_name: guestName,
        body: chatInput.trim(),
      });
      if (msgErr) throw msgErr;
      setChatInput('');
      fetchData();
    } catch (e) {
      captureException(e as Error, { screen: 'GuestTripView', action: 'sendMessage' });
      showToast('Failed to send message');
    }
  };

  const TABS: Array<{ id: Tab; label: string; icon: typeof MapPin }> = [
    { id: 'itinerary', label: 'Itinerary', icon: Calendar },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
  ];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingSkeleton variant="list" />
      </SafeAreaView>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState
          title="Trip not found"
          subtitle={error ?? "We couldn't find that trip. Check the link and try again."}
          icon={MapPin}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        {/* Trip Header */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={{ padding: 20, backgroundColor: colors.surface }}>
            <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>{trip.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Calendar size={14} color={colors.textMuted} />
              <Text style={{ fontSize: 14, color: colors.textMuted }}>
                {new Date(trip.start_date).toLocaleDateString()} – {new Date(trip.end_date).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* RSVP Banner */}
        {!bannerDismissed && rsvpStatus === 'none' && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View style={{ margin: 16, backgroundColor: colors.primaryMuted, borderRadius: 14, padding: 16 }}>
              <Text style={{ fontWeight: '600', color: colors.text, marginBottom: 10 }}>Are you going on this trip?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => handleRsvp('going')}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10 }}
                >
                  <Check size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>I'm Going</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRsvp('declined')}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10 }}
                >
                  <X size={16} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Can't Make It</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setBannerDismissed(true)} style={{ marginTop: 8, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Dismiss</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {rsvpStatus !== 'none' && (
          <View style={{ margin: 16, padding: 12, backgroundColor: rsvpStatus === 'going' ? '#D1FAE5' : '#FEE2E2', borderRadius: 10, alignItems: 'center' }}>
            <Text style={{ fontWeight: '600', color: rsvpStatus === 'going' ? '#065F46' : '#991B1B' }}>
              {rsvpStatus === 'going' ? "You're going! 🎉" : "You declined this trip"}
            </Text>
          </View>
        )}

        {/* Tab Bar */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 4 }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: active ? colors.primary : 'transparent' }}
              >
                <Icon size={15} color={active ? '#fff' : colors.textMuted} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.textMuted }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Itinerary Tab */}
        {activeTab === 'itinerary' && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            {teeTimes.length === 0 ? (
              <EmptyState title="No tee times yet" subtitle="Check back soon!" icon={Calendar} />
            ) : (
              teeTimes.map((tt) => (
                <Animated.View key={tt.id} entering={FadeInDown.duration(300)}>
                  <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontWeight: '600', color: colors.text, fontSize: 16 }}>{tt.course_name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 3 }}>{tt.tee_date} at {tt.tee_time}</Text>
                    {tt.course_city && <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{tt.course_city}</Text>}
                  </View>
                </Animated.View>
              ))
            )}
          </View>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            {expenses.length === 0 ? (
              <EmptyState title="No expenses yet" subtitle="Expenses will appear here" icon={DollarSign} />
            ) : (
              expenses.map((ex) => (
                <Animated.View key={ex.id} entering={FadeInDown.duration(300)}>
                  <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{ex.description}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>${(ex.amount_cents / 100).toFixed(2)} · {ex.category}</Text>
                  </View>
                </Animated.View>
              ))
            )}
          </View>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
              {messages.length === 0 ? (
                <EmptyState title="No messages yet" subtitle="Be the first to say something!" icon={MessageCircle} />
              ) : (
                messages.map((msg) => (
                  <Animated.View key={msg.id} entering={FadeInDown.duration(300)}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <Text style={{ fontWeight: '600', color: colors.primary, fontSize: 13 }}>{msg.guest_name ?? 'Anonymous'}</Text>
                      <Text style={{ color: colors.text, marginTop: 2 }}>{msg.body}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{new Date(msg.created_at).toLocaleString()}</Text>
                    </View>
                  </Animated.View>
                ))
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.textMuted}
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 15 }}
                />
                <Pressable
                  onPress={handleSendMessage}
                  style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Send</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </ScrollView>

      {/* Guest Name Modal */}
      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 }}>What's your name?</Text>
            <TextInput
              value={guestName}
              onChangeText={setGuestName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textMuted}
              style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.text, fontSize: 15, marginBottom: 16 }}
            />
            <Pressable
              onPress={() => { setShowNameModal(false); if (guestName.trim()) handleSendMessage(); }}
              style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
