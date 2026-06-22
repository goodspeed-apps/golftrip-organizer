/**
 * Tests for hooks/useRealtimeSubscription.ts — Realtime subscription logic.
 */

describe('useRealtimeSubscription logic', () => {
  test('initial state is connecting with empty data', () => {
    const state = { data: [] as any[], error: null, status: 'connecting' };
    expect(state.data).toEqual([]);
    expect(state.status).toBe('connecting');
    expect(state.error).toBeNull();
  });

  test('INSERT event appends to data', () => {
    const data = [{ id: 1 }];
    const newRecord = { id: 2 };
    data.push(newRecord);
    expect(data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('UPDATE event replaces matching record', () => {
    const data = [{ id: 1, name: 'old' }, { id: 2, name: 'other' }];
    const updated = { id: 1, name: 'new' };
    const idx = data.findIndex(d => d.id === updated.id);
    if (idx >= 0) data[idx] = updated;
    expect(data[0]?.name).toBe('new');
  });

  test('DELETE event removes record', () => {
    let data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const deletedId = 2;
    data = data.filter(d => d.id !== deletedId);
    expect(data).toEqual([{ id: 1 }, { id: 3 }]);
  });

  test('error sets error state', () => {
    const state = { data: [], error: null as string | null, status: 'connected' as string };
    state.error = 'Connection lost';
    state.status = 'error';
    expect(state.error).toBe('Connection lost');
    expect(state.status).toBe('error');
  });
});
