import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { Send, Bell, BellOff, Pin } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { MessageBubble } from '@/components/MessageBubble';

type Message = { id: string; body: string; thread_date: string; is_announcement: boolean; created_at: string; sender_member_id: string; guest_name: string | null; };
type Announcement = { id: string; body: string; is_active: boolean; };

export default function GroupChatScreen() {
  const colors = useThemeColors();
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const start = useRef(Date.now());
  const flatRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const done = trackApiLatency('fetch_chat');
    try {
      const [msgRes, annRes, memberRes] = await Promise.all([
        supabase.from('messages').select('*').eq('trip_id', tripId).eq('is_deleted', false).order('created_at', { ascending: true }),
        supabase.from('announcements').select('*').eq('trip_id', tripId).eq('is_active', true).order('created_at', { ascending: false }).limit(1),
        supabase.from('trip_members').select('notifications_muted').eq('trip_id', tripId).eq('user_id', user?.id ?? '').single(),
      ]);
      if (msgRes.error) throw msgRes.error;
      if (annRes.error) throw annRes.error;
      setMessages(msgRes.data ?? []);
      setAnnouncement(annRes.data?.[0] ?? null);
      setMuted(memberRes.data?.notifications_muted ?? false);
      trackScreenLoad('group_chat', start.current);
    } catch (e) {
      captureException(e as Error, { screen: 'group_chat', action: 'fetch' });
    } finally {
      done();
      setLoading(false);
    }
  }, [tripId, user?.id]);

  useEffect(() => {
    track('screen_view_group_chat', { tripId });
    fetchData();
    const channel = supabase.channel(`chat_${tripId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trip_id=eq.${tripId}` }, (payload) => {
      setMessages(prev => [...prev, payload.new as Message]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, track, tripId]);

  const sendMessage = async () => {
    if (!input.trim() || !tripId) return;
    setSending(true);
    const optimistic: Message = { id: `opt_${Date.now()}`, body: input.trim(), thread_date: new Date().toISOString().split('T')[0], is_announcement: false, created_at: new Date().toISOString(), sender_member_id: user?.id ?? '', guest_name: null };
    setMessages(prev => [...prev, optimistic]);
    const body = input.trim();
    setInput('');
    track('send_message', { tripId });
    const done = trackApiLatency('send_message');
    try {
      const { data: member } = await supabase.from('trip_members').select('id').eq('trip_id', tripId).eq('user_id', user?.id ?? '').single();
      const { error } = await supabase.from('messages').insert({ trip_id: tripId, sender_member_id: member?.id, body, thread_date: new Date().toISOString().split('T')[0] });
      if (error) throw error;
    } catch (e) {
      captureException(e as Error, { screen: 'group_chat', action: 'send' });
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally { done(); setSending(false); }
  };

  const toggleMute = async () => {
    track('toggle_mute', { tripId, muted: !muted });
    const next = !muted;
    setMuted(next);
    await supabase.from('trip_members').update({ notifications_muted: next }).eq('trip_id', tripId).eq('user_id', user?.id ?? '');
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Trip Chat</Text>
        <Pressable onPress={toggleMute} accessibilityLabel={muted ? 'Unmute notifications' : 'Mute notifications'} accessibilityHint="Toggle push notifications for this trip" style={{ padding: 8 }}>
          {muted ? <BellOff size={22} color={colors.textSecondary} /> : <Bell size={22} color={colors.primary} />}
        </Pressable>
      </View>
      {announcement && (
        <Animated.View entering={FadeInDown.duration(300)} style={{ backgroundColor: colors.warningMuted, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pin size={16} color={colors.warning} />
          <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.text }}>{announcement.body}</Text>
        </Animated.View>
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        {messages.length === 0
          ? <EmptyState icon="message-circle" title="No messages yet" subtitle="Be the first to say something to the group!" />
          : <FlatList ref={flatRef} data={messages} keyExtractor={m => m.id} renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 300)).duration(250)}>
                <MessageBubble message={item} isOwn={item.sender_member_id === user?.id} />
              </Animated.View>
            )} contentContainerStyle={{ padding: 12, gap: 8 }} onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })} />
        }
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TextInput value={input} onChangeText={setInput} placeholder="Say something..." placeholderTextColor={colors.textSecondary} style={{ flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text, minHeight: 44 }} multiline returnKeyType="send" onSubmitEditing={sendMessage} />
          <Pressable onPress={sendMessage} disabled={!input.trim() || sending} accessibilityLabel="Send message" accessibilityHint="Sends your message to the group" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
            {sending ? <ActivityIndicator size="small" color={colors.textOnPrimary} /> : <Send size={18} color={input.trim() ? colors.textOnPrimary : colors.textSecondary} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
