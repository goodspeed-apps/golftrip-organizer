/**
 * Admin, Payments
 *
 * Paginated view of the `transactions` table, ordered newest-first.
 */

import { useCallback, useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { VirtualList } from '@/components/VirtualList';
import { useThemeColors } from '@/context/ThemeContext';

const PAGE_SIZE = 20;

interface TxRow {
  id: string;
  amount: number | null;
  currency: string | null;
  status: string | null;
  user_id: string | null;
  product_id: string | null;
  created_at: string | null;
}

export default function AdminPaymentsScreen() {
  const { colors } = useThemeColors();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

const load = useCallback(async () => {
    // Guard against rapid Load more taps stacking duplicate requests for the
    // same page offset. Drops the second tap rather than queueing it.
    if (loading) return;
    setLoading(true);
    const offset = page * PAGE_SIZE;
    const { data } = await supabase
      .from('transactions')
      .select('id, amount, currency, status, user_id, product_id, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const results = (data ?? []) as TxRow[];
    setRows(prev => [...prev, ...results]);
    setPage(p => p + 1);
    setHasMore(results.length === PAGE_SIZE);
    setLoading(false);
  }, [page, loading]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <VirtualList
        data={rows}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={[styles.amount, { color: colors.text }]}>
                {item.currency?.toUpperCase() ?? 'USD'} {((item.amount ?? 0) / 100).toFixed(2)}
              </Text>
              <Text style={[styles.status, { color: statusColor(item.status, colors) }]}>
                {item.status ?? ', '}
              </Text>
            </View>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              User: {item.user_id?.slice(0, 8) ?? ', '} · {item.product_id ?? ', '}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {item.created_at ? new Date(item.created_at).toLocaleString() : ', '}
            </Text>
          </Card>
        )}
        ListFooterComponent={
          hasMore ? (
            <Button label={loading ? 'Loading…' : 'Load more'} onPress={load} loading={loading} variant="ghost" />
          ) : null
        }
      />
    </View>
  );
}

function statusColor(status: string | null, colors: { success: string; error: string; warning: string; textSecondary: string }) {
  if (status === 'completed' || status === 'succeeded') return colors.success;
  if (status === 'failed' || status === 'canceled') return colors.error;
  if (status === 'pending') return colors.warning;
  return colors.textSecondary;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  list: { gap: 8, paddingBottom: 32 },
  row: { gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 16, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  meta: { fontSize: 12 },
});
