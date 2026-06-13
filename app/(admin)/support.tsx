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
    listContent: { padding: 16, gap: 12 },
    threadCard: { padding: 16 },
    subject: { fontSize: 16, fontWeight: '600', color: colors.text },
    meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    badge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { fontSize: 12, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    msgList: { padding: 16, gap: 10 },
    msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
    msgText: { fontSize: 14 },
    msgMeta: { fontSize: 11, marginTop: 4, opacity: 0.6 },
    replyRow: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
    replyInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text },
    closeBtn: { padding: 4 },
  });

  const renderThread = ({ item }: { item: Thread }) => {
    const isOpen = item.status !== 'resolved';
    return (
      <TouchableOpacity onPress={() => openThread(item)}>
        <Card style={styles.threadCard}>
          <Text style={styles.subject}>{item.subject ?? '(no subject)'}</Text>
          <Text style={styles.meta}>From: {getDisplayName(item)}</Text>
          <Text style={styles.meta}>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}</Text>
          <View style={[styles.badge, { backgroundColor: isOpen ? colors.primaryMuted : colors.successMuted }]}>
            <Text style={[styles.badgeText, { color: isOpen ? colors.primary : colors.success }]}>
              {isOpen ? 'Open' : 'Resolved'}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <VirtualList
          data={threads}
          renderItem={renderThread}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 40 }}>No support threads yet.</Text>}
        />
      )}

      <Modal visible={!!active} animationType="slide" transparent onRequestClose={() => setActive(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{active?.subject ?? '(no subject)'}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setActive(null)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {msgLoading ? (
              <ActivityIndicator style={{ margin: 24 }} color={colors.primary} />
            ) : (
              <ScrollView contentContainerStyle={styles.msgList}>
                {messages.map(msg => {
                  const isAdmin = msg.author_role === 'admin';
                  return (
                    <View key={msg.id} style={[styles.msgBubble, { alignSelf: isAdmin ? 'flex-end' : 'flex-start', backgroundColor: isAdmin ? colors.primary : colors.surface }]}>
                      <Text style={[styles.msgText, { color: isAdmin ? '#fff' : colors.text }]}>{msg.body}</Text>
                      <Text style={[styles.msgMeta, { color: isAdmin ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
                        {msg.author_role} · {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.replyRow}>
              <TextInput
                style={styles.replyInput}
                value={reply}
                onChangeText={setReply}
                placeholder="Reply as admin…"
                placeholderTextColor={colors.textSecondary}
                multiline
              />
              <Button
                label="Send"
                onPress={sendReply}
                style={{ marginLeft: 8 }}
              />
            </View>

            <View style={{ padding: 16, paddingTop: 0 }}>
              <Button
                label="Mark Resolved"
                onPress={markResolved}
                disabled={active?.status === 'resolved'}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
