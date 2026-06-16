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

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerText: { fontSize: 20, fontWeight: '700', color: colors.text },
    threadItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    threadSubject: { fontSize: 16, fontWeight: '600', color: colors.text },
    threadMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
    closeBtn: { padding: 8 },
    closeBtnText: { fontSize: 16, color: colors.primary },
    messageList: { flex: 1, padding: 16 },
    messageBubble: { padding: 12, borderRadius: 12, marginBottom: 12, maxWidth: '85%' },
    messageBody: { fontSize: 14 },
    messageMeta: { fontSize: 11, marginTop: 4 },
    replyRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
    replyInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, backgroundColor: colors.surface, maxHeight: 100 },
    actionRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
    emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Support Threads</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : threads.length === 0 ? (
        <Text style={styles.emptyText}>No support threads yet.</Text>
      ) : (
        <ScrollView>
          {threads.map(thread => (
            <TouchableOpacity key={thread.id} style={styles.threadItem} onPress={() => openThread(thread)}>
              <Text style={styles.threadSubject}>{thread.subject ?? '(no subject)'}</Text>
              <Text style={styles.threadMeta}>{getDisplayName(thread)}</Text>
              <View style={[styles.badge, { backgroundColor: thread.status === 'resolved' ? colors.success + '22' : colors.warning + '22' }]}>
                <Text style={[styles.badgeText, { color: thread.status === 'resolved' ? colors.success : colors.warning }]}>
                  {thread.status ?? 'open'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!active} animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{active?.subject ?? '(no subject)'}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setActive(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          {msgLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <ScrollView style={styles.messageList}>
              {messages.map(msg => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    msg.author_role === 'admin'
                      ? { backgroundColor: colors.primary + '22', alignSelf: 'flex-end' }
                      : { backgroundColor: colors.surface, alignSelf: 'flex-start' },
                  ]}
                >
                  <Text style={[styles.messageBody, { color: colors.text }]}>{msg.body}</Text>
                  <Text style={[styles.messageMeta, { color: colors.textSecondary }]}>
                    {msg.author_role} · {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.replyRow}>
            <TextInput
              style={styles.replyInput}
              value={reply}
              onChangeText={setReply}
              placeholder="Write a reply…"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <TouchableOpacity
              onPress={sendReply}
              disabled={sending || !reply.trim()}
              style={{ justifyContent: 'center', paddingHorizontal: 12, backgroundColor: colors.primary, borderRadius: 8, opacity: sending || !reply.trim() ? 0.5 : 1 }}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Send</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={sendReply}
              disabled={sending || !reply.trim()}
              style={{ flex: 1, padding: 12, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center', opacity: sending ? 0.6 : 1 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Send Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={markResolved}
              disabled={active?.status === 'resolved'}
              style={{ flex: 1, padding: 12, backgroundColor: colors.success + '22', borderRadius: 8, alignItems: 'center', opacity: active?.status === 'resolved' ? 0.5 : 1 }}
            >
              <Text style={{ color: colors.success, fontWeight: '600' }}>Mark Resolved</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
