/**
 * Admin, Support
 *
 * Triage view for feedback_threads. Lists threads, shows full message history
 * in a modal, allows admin replies and marking threads resolved.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { VirtualList } from '@/components/VirtualList';
import { useThemeColors } from '@/context/ThemeContext';

interface Thread {
  id: string;
  subject: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  profiles?: { display_name: string | null } | { display_name: string | null }[] | null;
}

interface Message {
  id: string;
  body: string | null;
  author_role: string | null;
  author_id: string | null;
  created_at: string | null;
}

export default function AdminSupportScreen() {
  const { colors } = useThemeColors();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('feedback_threads')
      .select('id, subject, status, created_at, updated_at, profiles!feedback_threads_user_id_profiles_fk(display_name)')
      .order('updated_at', { ascending: false });
    setThreads((data ?? []) as unknown as Thread[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const openThread = useCallback(async (thread: Thread) => {
    setActive(thread);
    setMsgLoading(true);
    const { data } = await supabase
      .from('feedback_messages')
      .select('id, body, author_role, author_id, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
    setMsgLoading(false);
  }, []);

  const sendReply = useCallback(async () => {
    if (!active || !reply.trim()) return;
    setSending(true);
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user?.id;
    const { data: inserted, error } = await supabase
      .from('feedback_messages')
      .insert({
        thread_id: active.id,
        body: reply.trim(),
        author_role: 'admin',
        author_id: uid,
      })
      .select('id, body, author_role, author_id, created_at')
      .single();
    if (!error && inserted) {
      setMessages(prev => [...prev, inserted as Message]);
      setReply('');
    }
    setSending(false);
  }, [active, reply]);

  const markResolved = useCallback(async () => {
    if (!active) return;
    const previousStatus = active.status;
    setActive(prev => prev ? { ...prev, status: 'resolved' } : prev);
    setThreads(prev => prev.map(t => t.id === active.id ? { ...t, status: 'resolved' } : t));
    const { error } = await supabase.from('feedback_threads').update({ status: 'resolved' }).eq('id', active.id);
    if (error) {
      setActive(prev => prev ? { ...prev, status: previousStatus } : prev);
      setThreads(prev => prev.map(t => t.id === active.id ? { ...t, status: previousStatus } : t));
    }
  }, [active]);

  const getDisplayName = (thread: Thread): string => {
    if (!thread.profiles) return 'Unknown';
    if (Array.isArray(thread.profiles)) {
      return thread.profiles[0]?.display_name ?? 'Unknown';
    }
    return thread.profiles.display_name ?? 'Unknown';
  };

  const renderThread = ({ item }: { item: Thread }) => (
    <TouchableOpacity
      onPress={() => openThread(item)}
      style={[
        styles.threadItem,
        { backgroundColor: colors.card, borderColor: colors.border },
        item.status === 'resolved' && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.threadSubject, { color: colors.text }]}>{item.subject ?? '(no subject)'}</Text>
        <Text style={[styles.threadMeta, { color: colors.textSecondary }]}>
          {getDisplayName(item)} · {item.status ?? 'open'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Support Threads</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <VirtualList
          data={threads}
          renderItem={renderThread}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      <Modal visible={!!active} animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
              {active?.subject ?? '(no subject)'}
            </Text>
            <TouchableOpacity onPress={() => setActive(null)}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </View>

          {msgLoading ? (
            <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    msg.author_role === 'admin'
                      ? [styles.adminBubble, { backgroundColor: colors.primary }]
                      : [styles.userBubble, { backgroundColor: colors.card, borderColor: colors.border }],
                  ]}
                >
                  <Text style={[styles.messageBody, { color: msg.author_role === 'admin' ? '#fff' : colors.text }]}>
                    {msg.body}
                  </Text>
                  <Text style={[styles.messageTime, { color: msg.author_role === 'admin' ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
                    {msg.author_role === 'admin' ? 'Admin' : 'User'} · {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={[styles.replyContainer, { borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.replyInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Type a reply…"
              placeholderTextColor={colors.textSecondary}
              value={reply}
              onChangeText={setReply}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={sendReply}
                disabled={sending || !reply.trim()}
                style={[styles.replyBtn, { backgroundColor: colors.primary, flex: 1 }]}
              >
                <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>
                  {sending ? 'Sending…' : 'Send Reply'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={markResolved}
                disabled={active?.status === 'resolved'}
                style={[styles.replyBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flex: 1 }]}
              >
                <Text style={{ color: colors.text, fontWeight: '600', textAlign: 'center' }}>
                  {active?.status === 'resolved' ? 'Resolved' : 'Mark Resolved'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 24, fontWeight: '700', padding: 16 },
  threadItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 12, borderWidth: 1, marginBottom: 10,
  },
  threadSubject: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  threadMeta: { fontSize: 13 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', flex: 1, marginRight: 12 },
  messageBubble: { borderRadius: 12, padding: 12, marginBottom: 10, maxWidth: '85%' },
  adminBubble: { alignSelf: 'flex-end' },
  userBubble: { alignSelf: 'flex-start', borderWidth: 1 },
  messageBody: { fontSize: 15, lineHeight: 21 },
  messageTime: { fontSize: 11, marginTop: 4 },
  replyContainer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  replyInput: {
    borderRadius: 10, borderWidth: 1, padding: 12,
    fontSize: 15, minHeight: 80, textAlignVertical: 'top',
  },
  replyBtn: { padding: 14, borderRadius: 10 },
});
