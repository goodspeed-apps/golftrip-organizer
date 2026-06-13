/**
 * Admin, Feature Flags
 *
 * Lists all feature_flags rows. Per-row: enabled toggle, rollout slider, key, description.
 * "Add flag" opens a form for key / description / enabled / rollout_percentage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
// No Slider dep: rollout_percentage edited via numeric TextInput
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { VirtualList } from '@/components/VirtualList';
import { useThemeColors } from '@/context/ThemeContext';

interface FlagRow {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  rollout_percentage: number;
}

interface DraftFlag {
  key: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
}

const EMPTY_DRAFT: DraftFlag = { key: '', description: '', enabled: true, rollout_percentage: 100 };

export default function AdminFlagsScreen() {
  const { colors } = useThemeColors();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftFlag>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('feature_flags')
      .select('id, key, description, enabled, rollout_percentage')
      .order('key', { ascending: true });
    setFlags((data ?? []) as FlagRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

const toggleEnabled = useCallback(async (flag: FlagRow) => {
    const next = !flag.enabled;
    const previous = flag.enabled;
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: next } : f));
    const { error } = await supabase.from('feature_flags').update({ enabled: next }).eq('id', flag.id);
    if (error) {
      // Revert optimistic toggle so the UI matches the server.
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: previous } : f));
    }
  }, []);

  // Debounce slider/input writes so dragging across the range doesn't fire
  // a write per pixel. 300ms keystroke window matches lib/useDebounce.
  const rolloutTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = rolloutTimers.current;
    return () => { timers.forEach(t => clearTimeout(t)); };
  }, []);

  const updateRollout = useCallback((flag: FlagRow, value: number) => {
    const pct = Math.round(value);
    const previous = flag.rollout_percentage;
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, rollout_percentage: pct } : f));

    const existing = rolloutTimers.current.get(flag.id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      rolloutTimers.current.delete(flag.id);
      const { error } = await supabase.from('feature_flags').update({ rollout_percentage: pct }).eq('id', flag.id);
      if (error) {
        setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, rollout_percentage: previous } : f));
      }
    }, 300);
    rolloutTimers.current.set(flag.id, t);
  }, []);

  const addFlag = useCallback(async () => {
    if (!draft.key.trim()) return;
    setSaving(true);
    await supabase.from('feature_flags').insert({
      key: draft.key.trim(),
      description: draft.description.trim() || null,
      enabled: draft.enabled,
      rollout_percentage: draft.rollout_percentage,
    });
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
    await fetchFlags();
    setSaving(false);
  }, [draft, fetchFlags]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Button label="Add flag" onPress={() => setShowForm(true)} style={styles.addBtn} />
<VirtualList
        data={flags}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.flagCard}>
            <View style={styles.flagTop}>
              <View style={styles.flagMeta}>
                <Text style={[styles.key, { color: colors.text, fontFamily: 'monospace' }]}>{item.key}</Text>
                {item.description ? (
                  <Text style={[styles.desc, { color: colors.textSecondary }]}>{item.description}</Text>
                ) : null}
              </View>
              <Switch
                value={item.enabled}
                onValueChange={() => toggleEnabled(item)}
                trackColor={{ true: colors.success ?? '#10B981' }}
              />
            </View>
<View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>Rollout</Text>
              <TextInput
                style={[styles.rolloutInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                keyboardType="number-pad"
                maxLength={3}
                value={String(item.rollout_percentage)}
                onEndEditing={e => {
                  const v = Math.min(100, Math.max(0, parseInt(e.nativeEvent.text, 10) || 0));
                  updateRollout(item, v);
                }}
              />
              <Text style={[styles.pct, { color: colors.textSecondary }]}>%</Text>
            </View>
          </Card>
        )}
      />

      <Modal visible={showForm} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowForm(false)}>
        <View style={[styles.form, { backgroundColor: colors.background }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>New Feature Flag</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="key (snake_case)"
            placeholderTextColor={colors.textSecondary}
            value={draft.key}
            onChangeText={t => setDraft(d => ({ ...d, key: t }))}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textSecondary}
            value={draft.description}
            onChangeText={t => setDraft(d => ({ ...d, description: t }))}
          />
          <View style={styles.formRow}>
            <Text style={[styles.formLabel, { color: colors.text }]}>Enabled</Text>
            <Switch
              value={draft.enabled}
              onValueChange={v => setDraft(d => ({ ...d, enabled: v }))}
              trackColor={{ true: colors.success ?? '#10B981' }}
            />
          </View>
<View style={styles.formRow}>
            <Text style={[styles.formLabel, { color: colors.text }]}>Rollout %</Text>
            <TextInput
              style={[styles.input, { width: 80, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              keyboardType="number-pad"
              maxLength={3}
              value={String(draft.rollout_percentage)}
              onChangeText={t => {
                const v = Math.min(100, Math.max(0, parseInt(t, 10) || 0));
                setDraft(d => ({ ...d, rollout_percentage: v }));
              }}
            />
          </View>
          <View style={styles.formActions}>
            <Button label="Cancel" onPress={() => setShowForm(false)} variant="ghost" />
            <Button label="Add" onPress={addFlag} loading={saving} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addBtn: { marginBottom: 12 },
  list: { gap: 8, paddingBottom: 32 },
  flagCard: { gap: 8 },
  flagTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  flagMeta: { flex: 1, marginRight: 12, gap: 2 },
  key: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 12 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderLabel: { fontSize: 12, width: 44 },
  rolloutInput: { width: 52, height: 32, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, fontSize: 13, textAlign: 'center' },
  pct: { fontSize: 12, width: 14 },
  form: { flex: 1, padding: 24, gap: 16 },
  formTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  input: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  formRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formLabel: { fontSize: 15 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
