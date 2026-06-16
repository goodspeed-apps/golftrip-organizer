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
      style={[styles.threadRow, { borderBottomColor: colors.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.threadSubject, { color: colors.text }]} numberOfLines={1}>
          {item.subject ?? '(no subject)'}
        </Text>
        <Text style={[styles.threadMeta, { color: colors.textSecondary }]}>
          {getDisplayName(item)} · {item.status ?? 'open'}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: item.status === 'resolved' ? colors.success + '22' : colors.warning + '22' }]}>
        <Text style={{ color: item.status === 'resolved' ? colors.success : colors.warning, fontSize: 11 }}>
          {item.status ?? 'open'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Support Threads</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <VirtualList
          data={threads}
          renderItem={renderThread}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>No threads yet.</Text>}
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
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {messages.map(msg => (
                <View
                  key={msg.id}
                  style={[
                    styles.bubble,
                    msg.author_role === 'admin'
                      ? { alignSelf: 'flex-end', backgroundColor: colors.primary + '22' }
                      : { alignSelf: 'flex-start', backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={[styles.bubbleRole, { color: colors.textSecondary }]}>
                    {msg.author_role === 'admin' ? 'Admin' : 'User'}
                  </Text>
                  <Text style={[styles.bubbleBody, { color: colors.text }]}>{msg.body}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={[styles.replyBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.replyInput, { color: colors.text, borderColor: colors.border }]}
              value={reply}
              onChangeText={setReply}
              placeholder="Write a reply…"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={styles.replyActions}>
              <Button
                title={sending ? 'Sending…' : 'Send'}
                onPress={sendReply}
                style={{ flex: 1 }}
              />
              <Button
                title={active?.status === 'resolved' ? 'Resolved ✓' : 'Mark Resolved'}
                onPress={markResolved}
                variant="secondary"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 22, fontWeight: '700', padding: 16 },
  threadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  threadSubject: { fontSize: 15, fontWeight: '600' },
  threadMeta: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 12 },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 10, marginBottom: 10 },
  bubbleRole: { fontSize: 11, marginBottom: 3 },
  bubbleBody: { fontSize: 14 },
  replyBar: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  replyInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    minHeight: 60, fontSize: 14, marginBottom: 8,
  },
  replyActions: { flexDirection: 'row', gap: 8 },
});
