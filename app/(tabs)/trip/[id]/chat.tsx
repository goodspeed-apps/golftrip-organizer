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

interface Message {
  id: string;
  body: string;
  sender_member_id: string;
  guest_name: string | null;
  thread_date: string;
  is_announcement: boolean;
  created_at: string;
  sender_display_name?: string;
}

interface Announcement { id: string; body: string; is_active: boolean; }

export default function GroupChatScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [messages, setMessages] = useState<Message[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [muted, setMuted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);
  const start = useRef(Date.now());
  const muteScale = useSharedValue(1);
  const muteStyle = useAnimatedStyle(() => ({ transform: [{ scale: muteScale.value }] }));

  const fetchData = useCallback(async () => {
    if (!user?.id || !tripId) { setLoading(false); return; }
    const end = trackApiLatency('fetch_chat');
    try {
      const [{ data: member }, { data: msgs }, { data: ann }] = await Promise.all([
        supabase.from('trip_members').select('id,notifications_muted').eq('trip_id', tripId).eq('user_id', user.id).single(),
        supabase.from('messages').select('*').eq('trip_id', tripId).eq('is_deleted', false).order('created_at', { ascending: true }),
        supabase.from('announcements').select('*').eq('trip_id', tripId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).single(),
      ]);
      if (member) { setMemberId(member.id); setMuted(member.notifications_muted ?? false); }
      setMessages((msgs as Message[]) ?? []);
      setAnnouncement(ann as Announcement | null);
      trackScreenLoad('group_chat', start.current);
      track('screen_view_group_chat', { tripId });
    } catch (e) {
      captureException(e as Error, { screen: 'group_chat', action: 'fetch' });
    } finally {
      end(); setLoading(false);
    }
  }, [user?.id, tripId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!tripId) return;
    const ch = supabase.channel(`chat:${tripId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trip_id=eq.${tripId}` },
        (payload) => { setMessages(prev => [...prev, payload.new as Message]); setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const sendMessage = async () => {
    const body = inputText.trim();
    if (!body || !memberId) return;
    setInputText('');
    track('send_chat_message', { tripId });
    const optimistic: Message = { id: `opt-${Date.now()}`, body, sender_member_id: memberId, guest_name: null, thread_date: new Date().toISOString().split('T')[0], is_announcement: false, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    const { error } = await supabase.from('messages').insert({ trip_id: tripId, sender_member_id: memberId, body, thread_date: optimistic.thread_date, is_announcement: false });
    if (error) captureException(error, { screen: 'group_chat', action: 'send_message' });
  };

  const toggleMute = async () => {
    if (!memberId) return;
    muteScale.value = withSpring(0.9, {}, () => { muteScale.value = withSpring(1); });
    const next = !muted; setMuted(next);
    track('toggle_chat_mute', { tripId, muted: next });
    const { error } = await supabase.from('trip_members').update({ notifications_muted: next }).eq('id', memberId);
    if (error) { captureException(error, { screen: 'group_chat', action: 'toggle_mute' }); setMuted(!next); }
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Trip Chat</Text>
        <Animated.View style={muteStyle}>
          <Pressable onPress={toggleMute} accessibilityLabel={muted ? 'Unmute notifications' : 'Mute notifications'} accessibilityHint="Toggles push notifications for this trip" style={{ padding: 8 }}>
            {muted ? <BellOff size={22} color={colors.textSecondary} /> : <Bell size={22} color={colors.primary} />}
          </Pressable>
        </Animated.View>
      </View>
      {announcement && (
        <View style={{ backgroundColor: colors.warning, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Pin size={16} color={colors.text} />
          <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.text }}>{announcement.body}</Text>
        </View>
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {messages.length === 0
          ? <EmptyState icon="MessageCircle" title="No messages yet" description="Be the first to say something to the group!" />
          : <FlatList ref={flatRef} data={messages} keyExtractor={item => item.id} renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
                <MessageBubble message={item} isOwn={item.sender_member_id === memberId} />
              </Animated.View>
            )} contentContainerStyle={{ padding: 12, paddingBottom: 8 }} onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })} />
        }
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: 8 }}>
          <TextInput value={inputText} onChangeText={setInputText} placeholder="Send a message…" placeholderTextColor={colors.textSecondary} style={{ flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 22, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text, backgroundColor: colors.background }} multiline accessibilityLabel="Message input" />
          <Pressable onPress={sendMessage} disabled={!inputText.trim()} accessibilityLabel="Send message" accessibilityHint="Sends your message to the group" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: inputText.trim() ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Send size={20} color={colors.textOnPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
