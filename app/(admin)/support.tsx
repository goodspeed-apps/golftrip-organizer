/**
 * Admin — Support
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
  // Supabase returns the joined relation as an array or single object depending on query shape
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
    // Disambiguate the FK to public.profiles (added in migration 012); the
    // base feedback_threads.user_id FK points at auth.users which PostgREST
    // can't traverse from the anon schema.
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
    // Round-tripping select().single() avoids re-fetching the entire thread
    // after every reply; we just append the new row to local state.
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
    // Optimistic update with revert-on-failure: snapshot the prior status so
    // a network failure rolls the badge back instead of stranding a stale UI.
    setActive(prev => prev ? { ...prev, status: 'resolved' } : prev);
    setThreads(prev => prev.map(t => t.id === active.id ? { ...t, status: 'resolved' } : t));
    const { error } = await supabase.from('feedback_threads').update({ status: 'resolved' }).eq('id', active.id);
    if (error) {
      setActive(prev => prev ? { ...prev, status: previousStatus } : prev);
      setThreads(prev => prev.map(t => t.id === active.id ? { ...t, status: previousStatus } : t));
    }
  }, [active]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <VirtualList
        data={threads}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card onPress={() => openThread(item)} style={styles.threadCard}>
            <View style={styles.threadTop}>
              <Text style={[styles.subject, { color: colors.text }]} numberOfLines={1}>
                {item.subject ?? '(no subject)'}
              </Text>
              <View style={[styles.badge, { backgroundColor: badgeColor(item.status, colors) }]}>
                <Text style={styles.badgeText}>{item.status ?? 'open'}</Text>
              </View>
            </View>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {(item.profiles as { display_name: string | null } | null)?.display_name ?? 'Unknown'} ·{' '}
              {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}
            </Text>
          </Card>
        )}
      />

      <Modal visible={!!active} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActive(null)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
              {active?.subject ?? '(no subject)'}
            </Text>
            <TouchableOpacity onPress={() => setActive(null)}>
              <Text style={[styles.closeBtn, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          {msgLoading ? (
            <View style={styles.center}><ActivityIndicator /></View>
          ) : (
            <ScrollView style={styles.messages} contentContainerStyle={styles.messagesList}>
              {messages.map(msg => (
                <View
                  key={msg.id}
                  style={[
                    styles.bubble,
                    msg.author_role === 'admin'
                      ? [styles.bubbleAdmin, { backgroundColor: colors.primary }]
                      : [styles.bubbleUser, { backgroundColor: colors.surface, borderColor: colors.border }],
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: msg.author_role === 'admin' ? '#fff' : colors.text }]}>
                    {msg.body}
                  </Text>
                  <Text style={[styles.bubbleMeta, { color: msg.author_role === 'admin' ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
                    {msg.author_role === 'admin' ? 'Admin' : 'User'} ·{' '}
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={[styles.replyBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.replyInput, { color: colors.text }]}
              placeholder="Reply…"
              placeholderTextColor={colors.textSecondary}
              value={reply}
              onChangeText={setReply}
              multiline
            />
            <Button label="Send" onPress={sendReply} loading={sending} size="sm" />
          </View>

          {active?.status !== 'resolved' && (
            <View style={styles.resolveRow}>
              <Button label="Mark Resolved" onPress={markResolved} variant="secondary" fullWidth />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function badgeColor(status: string | null, colors: { success: string; warning: string; textSecondary: string }) {
  if (status === 'resolved') return colors.success;
  if (status === 'pending') return colors.warning;
  return colors.textSecondary;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { gap: 8, paddingBottom: 32 },
  threadCard: { gap: 4 },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subject: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 12 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 12 },
  closeBtn: { fontSize: 15 },
  messages: { flex: 1 },
  messagesList: { padding: 16, gap: 12 },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 12 },
  bubbleAdmin: { alignSelf: 'flex-end' },
  bubbleUser: { alignSelf: 'flex-start', borderWidth: 1 },
  bubbleText: { fontSize: 14 },
  bubbleMeta: { fontSize: 10, marginTop: 4 },
  replyBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  replyInput: { flex: 1, fontSize: 15, maxHeight: 100 },
  resolveRow: { padding: 16, paddingTop: 0 },
});
