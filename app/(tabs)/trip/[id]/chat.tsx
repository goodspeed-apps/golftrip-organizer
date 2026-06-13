import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Send, BellOff, Bell, Pin } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { MessageBubble } from '@/components/MessageBubble';

type Message = {
  id: string; trip_id: string; sender_member_id: string | null;
  guest_name: string | null; body: string; thread_date: string | null;
  is_announcement: boolean; is_deleted: boolean; created_at: string;
  sender_display_name?: string;
};
type Announcement = { id: string; body: string; is_active: boolean };

export default function GroupChatScreen() {
  const colors = useThemeColors();
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [messages, setMessages] = useState<Message[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [input, setInput] = useState('');
  const [memberId, setMemberId] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);
  const startTime = useRef(Date.now());

  const muteScale = useSharedValue(1);
  const muteStyle = useAnimatedStyle(() => ({ transform: [{ scale: muteScale.value }] }));

  useEffect(() => { track('screen_view_group_chat', { trip_id: tripId }); }, []);

  const fetchAll = useCallback(async () => {
    if (!tripId || !user?.id) { setLoading(false); return; }
    const end = trackApiLatency('fetch_chat');
    try {
      const [{ data: mem }, { data: msgs }, { data: ann }] = await Promise.all([
        supabase.from('trip_members').select('id,notifications_muted').eq('trip_id', tripId).eq('user_id', user.id).single(),
        supabase.from('messages').select('*').eq('trip_id', tripId).eq('is_deleted', false).order('created_at', { ascending: true }),
        supabase.from('announcements').select('*').eq('trip_id', tripId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (mem) { setMemberId(mem.id); setMuted(mem.notifications_muted ?? false); }
      setMessages(msgs ?? []);
      setAnnouncement(ann ?? null);
      trackScreenLoad('GroupChat', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'GroupChat', action: 'fetchAll' });
    } finally { end(); setLoading(false); }
  }, [tripId, user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!tripId) return;
    const channel = supabase.channel(`chat:${tripId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trip_id=eq.${tripId}` },
        (payload) => { setMessages(p => [...p, payload.new as Message]); setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tripId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !memberId) return;
    track('send_chat_message', { trip_id: tripId });
    const optimistic: Message = { id: `opt-${Date.now()}`, trip_id: tripId!, sender_member_id: memberId, guest_name: null, body: input.trim(), thread_date: null, is_announcement: false, is_deleted: false, created_at: new Date().toISOString() };
    setMessages(p => [...p, optimistic]);
    setInput('');
    flatRef.current?.scrollToEnd({ animated: true });
    const { error } = await supabase.from('messages').insert({ trip_id: tripId, sender_member_id: memberId, body: optimistic.body });
    if (error) { captureException(error, { screen: 'GroupChat', action: 'sendMessage' }); setMessages(p => p.filter(m => m.id !== optimistic.id)); }
  }, [input, memberId, tripId]);

  const toggleMute = useCallback(async () => {
    if (!memberId) return;
    muteScale.value = withSpring(0.85, {}, () => { muteScale.value = withSpring(1); });
    const next = !muted;
    setMuted(next);
    track('toggle_chat_mute', { trip_id: tripId, muted: next });
    const { error } = await supabase.from('trip_members').update({ notifications_muted: next }).eq('id', memberId);
    if (error) { captureException(error, { screen: 'GroupChat', action: 'toggleMute' }); setMuted(!next); }
  }, [muted, memberId]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text }}>Group Chat</Text>
        <Pressable onPress={toggleMute} accessibilityLabel={muted ? 'Unmute notifications' : 'Mute notifications'} accessibilityHint="Toggle push notifications for this trip" style={{ padding: 8, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={muteStyle}>{muted ? <BellOff size={22} color={colors.textSecondary} /> : <Bell size={22} color={colors.primary} />}</Animated.View>
        </Pressable>
      </View>

      {announcement && (
        <Animated.View entering={FadeInDown.duration(300)} style={{ backgroundColor: colors.warningMuted, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pin size={16} color={colors.warning} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text }}>{announcement.body}</Text>
        </Animated.View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {messages.length === 0
          ? <EmptyState icon="MessageCircle" title="No messages yet" description="Start the conversation with your group!" />
          : <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={m => m.id}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(Math.min(index * 20, 200)).duration(250)}>
                  <MessageBubble message={item} isOwn={item.sender_member_id === memberId} />
                </Animated.View>
              )}
            />
        }
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TextInput
            style={{ flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text, minHeight: 44, maxHeight: 100 }}
            placeholder="Message the group…"
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            accessibilityLabel="Message input"
          />
          <Pressable onPress={sendMessage} disabled={!input.trim()} accessibilityLabel="Send message" accessibilityHint="Sends your message to the group" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center' }}>
            <Send size={18} color={colors.textOnPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
