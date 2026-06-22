/**
 * Admin, Users
 *
 * Displays paginated rows from `profiles`. Email is not available client-side
 * (auth.users is server-only); only columns present in `profiles` are shown.
 */

import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { VirtualList } from '@/components/VirtualList';
import { useDebounce } from '@/hooks/useDebounce';
import { useThemeColors } from '@/context/ThemeContext';
import { monoFamily } from '@/lib/fonts';

const PAGE_SIZE = 20;

interface ProfileRow {
  id: string;
  display_name: string | null;
  role: string | null;
  created_at: string | null;
}

export default function AdminUsersScreen() {
  const { colors } = useThemeColors();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

const load = useCallback(async (resetPage = false) => {
    // Guard against rapid Load more taps that would otherwise re-fetch the
    // same page offset. A search reset still fires (resetPage=true comes
    // from an effect, not a tap).
    if (loading && !resetPage) return;
    setLoading(true);
    const offset = resetPage ? 0 : page * PAGE_SIZE;
    let query = supabase
      .from('profiles')
      .select('id, display_name, role, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (debouncedSearch.trim()) {
      query = query.ilike('display_name', `%${debouncedSearch.trim()}%`);
    }

    const { data } = await query;
    const results = (data ?? []) as ProfileRow[];
    if (resetPage) {
      setRows(results);
      setPage(1);
    } else {
      setRows(prev => [...prev, ...results]);
      setPage(p => p + 1);
    }
    setHasMore(results.length === PAGE_SIZE);
    setLoading(false);
  }, [page, debouncedSearch, loading]);

  useEffect(() => {
    load(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextInput
        style={[styles.search, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        placeholder="Search by display name…"
        placeholderTextColor={colors.textSecondary}
        value={search}
        onChangeText={setSearch}
      />
<VirtualList
        data={rows}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <Text style={[styles.id, { color: colors.textSecondary }]}>{item.id.slice(0, 8)}</Text>
            <Text style={[styles.name, { color: colors.text }]}>{item.display_name ?? ', '}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {item.role ?? 'user'} · {item.created_at ? new Date(item.created_at).toLocaleDateString() : ', '}
            </Text>
          </Card>
        )}
        ListFooterComponent={
          hasMore ? (
            <Button label={loading ? 'Loading…' : 'Load more'} onPress={() => load()} loading={loading} variant="ghost" />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  search: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  list: { gap: 8, paddingBottom: 32 },
  row: { gap: 2 },
  id: { fontSize: 11, fontFamily: monoFamily() },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12 },
});
