/**
 * Tests for services/api.ts — API helper logic.
 */

// Mock all dependencies before importing
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));

const mockNetInfo = {
  fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
  addEventListener: jest.fn(() => jest.fn()),
};
jest.mock('@react-native-community/netinfo', () => mockNetInfo);

const mockQueryBuilder: any = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
};
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockQueryBuilder),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'test-user' } }, error: null })) },
    functions: { invoke: jest.fn(async () => ({ data: { result: 'ok' }, error: null })) },
  },
}));
jest.mock('../../lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('../../lib/sentry', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock('../../lib/performance', () => ({ trackApiLatency: jest.fn() }));
jest.mock('../../lib/retry', () => ({
  retryWithBackoff: jest.fn(async (fn: () => Promise<any>) => fn()),
}));
jest.mock('../../lib/offline', () => ({
  cacheQuery: jest.fn(async () => {}),
  getCached: jest.fn(async () => null),
  clearCache: jest.fn(async () => {}),
  queueMutation: jest.fn(async () => {}),
  flushQueue: jest.fn(async () => {}),
  getQueueLength: jest.fn(async () => 0),
  cleanupStaleCache: jest.fn(async () => 0),
}));

import { isOnline, withCache, callEdge, enqueueOffline } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { getCached } from '../../lib/offline';

beforeEach(() => {
  jest.clearAllMocks();
  mockNetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true, type: 'wifi' });
});

describe('isOnline', () => {
  test('returns true when connected', async () => {
    expect(await isOnline()).toBe(true);
  });

  test('returns false when disconnected', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false, type: 'none' });
    expect(await isOnline()).toBe(false);
  });
});

describe('withCache', () => {
  test('fetches and returns fresh data when online', async () => {
    const fetcher = jest.fn(async () => ({ value: 42 }));
    const result = await withCache('test-key', 60000, fetcher);
    expect(result).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('throws when offline with no cache', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false, type: 'none' });
    await expect(withCache('key', 60000, async () => 'data')).rejects.toThrow('Offline');
  });

  test('returns cached data when offline', async () => {
    mockNetInfo.fetch.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false, type: 'none' });
    (getCached as jest.Mock).mockResolvedValueOnce({ data: { cached: true }, timestamp: Date.now() });
    const result = await withCache('key', 60000, async () => 'fresh');
    expect(result).toEqual({ cached: true });
  });
});

describe('callEdge', () => {
  test('invokes edge function and returns data', async () => {
    const result = await callEdge<{ result: string }>('test-fn', { input: 1 });
    expect(result).toEqual({ result: 'ok' });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('test-fn', expect.anything());
  });

  test('throws when edge function returns error', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({ data: null, error: new Error('fn error') });
    await expect(callEdge('bad-fn')).rejects.toThrow('fn error');
  });

  test('throws when data is null', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
    await expect(callEdge('null-fn')).rejects.toThrow('null-fn returned no data');
  });
});

describe('enqueueOffline', () => {
  test('executes immediately when online', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({ data: {}, error: null });
    await enqueueOffline('endpoint', { key: 'val' });
    expect(supabase.functions.invoke).toHaveBeenCalled();
  });
});

// ─── CRUD Functions ──────────────────────────────────────────────────────────

import { getUserProfile, updateUserProfile, getNotifications, markNotificationRead, getUnreadNotificationCount, toggleBookmark, getBookmarks } from '../../services/api';

describe('getUserProfile', () => {
  test('returns null when no user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({ data: { user: null }, error: null });
    const result = await getUserProfile();
    expect(result).toBeNull();
  });

  test('returns profile via withCache', async () => {
    mockQueryBuilder.then = jest.fn((resolve: any) => resolve({ data: { id: 'test-user', display_name: 'Alice' }, error: null }));
    const result = await getUserProfile();
    expect(result).toBeDefined();
  });
});

describe('updateUserProfile', () => {
  test('throws when no user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(updateUserProfile({ display_name: 'Bob' })).rejects.toThrow('Not authenticated');
  });

  test('calls update on profiles table', async () => {
    mockQueryBuilder.then = jest.fn((resolve: any) => resolve({ error: null }));
    await updateUserProfile({ display_name: 'Bob' });
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });
});

describe('getNotifications', () => {
  test('returns empty when no user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({ data: { user: null }, error: null });
    const result = await getNotifications();
    expect(result).toEqual({ data: [], count: 0, hasMore: false });
  });

  test('returns paginated notifications', async () => {
    mockQueryBuilder.then = jest.fn((resolve: any) => resolve({ data: [{ id: '1' }], error: null, count: 1 }));
    const result = await getNotifications(0, 20);
    expect(result.data).toHaveLength(1);
  });
});

describe('markNotificationRead', () => {
  test('updates notification', async () => {
    mockQueryBuilder.then = jest.fn((resolve: any) => resolve({ error: null }));
    await markNotificationRead('notif-1');
    expect(supabase.from).toHaveBeenCalledWith('notifications');
  });
});

describe('getUnreadNotificationCount', () => {
  test('returns 0 when no user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({ data: { user: null }, error: null });
    const count = await getUnreadNotificationCount();
    expect(count).toBe(0);
  });

  test('returns count', async () => {
    mockQueryBuilder.then = jest.fn((resolve: any) => resolve({ count: 5, error: null }));
    const count = await getUnreadNotificationCount();
    expect(typeof count).toBe('number');
  });
});

describe('toggleBookmark', () => {
  test('throws when no user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(toggleBookmark('post', '123')).rejects.toThrow('Not authenticated');
  });
});

describe('getBookmarks', () => {
  test('returns empty when no user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({ data: { user: null }, error: null });
    const result = await getBookmarks('post');
    expect(result).toEqual([]);
  });

  test('returns bookmarks array', async () => {
    mockQueryBuilder.then = jest.fn((resolve: any) => resolve({ data: [{ id: 'b1', entity_type: 'post' }], error: null }));
    const result = await getBookmarks('post');
    expect(Array.isArray(result)).toBe(true);
  });
});
