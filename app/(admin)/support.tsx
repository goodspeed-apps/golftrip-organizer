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
    headerText: { fontSize: 22, fontWeight: '700', color: colors.text },
    threadItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    threadSubject: { fontSize: 16, fontWeight: '600', color: colors.text },
    threadMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, marginTop: 4 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    closeBtn: { padding: 4 },
    closeBtnText: { fontSize: 16, color: colors.primary },
    msgList: { flex: 1, padding: 16 },
    msgBubble: { marginBottom: 12, padding: 12, borderRadius: 12, maxWidth: '80%' },
    msgBody: { fontSize: 14 },
    msgMeta: { fontSize: 11, marginTop: 4 },
    replyBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
    replyInput: { flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, backgroundColor: colors.card },
    actionsRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { color: colors.textSecondary, fontSize: 16 },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Support Threads</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No threads yet.</Text>
        </View>
      ) : (
        <VirtualList
          data={threads}
          keyExtractor={(item) => (item as Thread).id}
          renderItem={({ item }) => {
            const thread = item as Thread;
            const isResolved = thread.status === 'resolved';
            return (
              <TouchableOpacity style={styles.threadItem} onPress={() => openThread(thread)}>
                <Text style={styles.threadSubject}>{thread.subject ?? '(no subject)'}</Text>
                <Text style={styles.threadMeta}>{getDisplayName(thread)} · {thread.updated_at ? new Date(thread.updated_at).toLocaleDateString() : ''}</Text>
                <View style={[styles.badge, { backgroundColor: isResolved ? colors.successMuted ?? '#dcfce7' : colors.warningMuted ?? '#fef9c3' }]}>
                  <Text style={[styles.badgeText, { color: isResolved ? colors.success ?? '#16a34a' : colors.warning ?? '#ca8a04' }]}>{thread.status ?? 'open'}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!active} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{active?.subject ?? '(no subject)'}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setActive(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          {msgLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
          ) : (
            <ScrollView style={styles.msgList}>
              {messages.map((msg) => {
                const isAdmin = msg.author_role === 'admin';
                return (
                  <View key={msg.id} style={[styles.msgBubble, { backgroundColor: isAdmin ? colors.primary : colors.card, alignSelf: isAdmin ? 'flex-end' : 'flex-start' }]}>
                    <Text style={[styles.msgBody, { color: isAdmin ? '#fff' : colors.text }]}>{msg.body}</Text>
                    <Text style={[styles.msgMeta, { color: isAdmin ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
                      {msg.author_role} · {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.replyBar}>
            <TextInput
              style={styles.replyInput}
              placeholder="Type a reply…"
              placeholderTextColor={colors.textSecondary}
              value={reply}
              onChangeText={setReply}
              multiline
            />
            <TouchableOpacity
              onPress={sendReply}
              disabled={sending || !reply.trim()}
              style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 8, opacity: sending || !reply.trim() ? 0.5 : 1 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>{sending ? '…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={markResolved}
              style={{ flex: 1, paddingVertical: 12, backgroundColor: colors.success ?? '#16a34a', borderRadius: 8, alignItems: 'center', opacity: active?.status === 'resolved' ? 0.5 : 1 }}
              disabled={active?.status === 'resolved'}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Mark Resolved</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActive(null)}
              style={{ flex: 1, paddingVertical: 12, backgroundColor: colors.card, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
