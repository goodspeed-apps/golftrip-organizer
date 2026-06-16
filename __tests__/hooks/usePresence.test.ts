/**
 * Tests for hooks/usePresence.ts — Supabase Realtime presence channel.
 * The hook routes through the shared services/realtime channel cache.
 */

const mockChannel: Record<string, any> = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return mockChannel;
  }),
  track: jest.fn().mockResolvedValue('ok'),
  untrack: jest.fn().mockResolvedValue('ok'),
  presenceState: jest.fn().mockReturnValue({}),
  send: jest.fn().mockResolvedValue('ok'),
  unsubscribe: jest.fn(),
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn().mockResolvedValue('ok'),
  },
}));

// Pin the gas.config fields the impl chain reads to the template values these
// tests assume, so a generated app that customizes gasConfig (realtime block,
// i18n, etc.) still exercises the template behavior under test. The realtime
// service only reads `gasConfig.realtime?.presenceTimeoutMs`.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    realtime: {
      presenceTimeoutMs: 30_000,
      autoReconnect: true,
      defaultRetries: 3,
    },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePresence } from '../../hooks/usePresence';
import { supabase } from '../../lib/supabase';
import { __clearChannelCache, presenceCacheKey } from '../../services/realtime';

beforeEach(() => {
  __clearChannelCache();
  jest.clearAllMocks();
  mockChannel.on.mockReturnThis();
  mockChannel.subscribe.mockImplementation((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return mockChannel;
  });
  mockChannel.presenceState.mockReturnValue({});
  (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
});

describe('usePresence', () => {
  test('subscribes and tracks payload on mount', async () => {
    const payload = { user_id: 'user-1', name: 'Alice' };

    const { result } = await renderHook(() => usePresence('room:1', payload));

    expect(supabase.channel).toHaveBeenCalledWith('room:1', {
      config: { presence: { key: 'user-1' } },
    });
    expect(mockChannel.subscribe).toHaveBeenCalled();
    // track + 'joined' status fire after the cache's `subscribed` promise
    // resolves on the microtask queue.
    await waitFor(() => expect(mockChannel.track).toHaveBeenCalledWith(payload));
    expect(result.current.status).toBe('joined');
  });

  test('uses randomUUID when payload has no user_id', async () => {
    await renderHook(() => usePresence('room:anon', { display: 'Guest' }));

    expect(supabase.channel).toHaveBeenCalledWith('room:anon', {
      config: { presence: { key: 'test-uuid-1234' } },
    });
  });

  test('recomputes peers from presenceState on sync event', async () => {
    const peer: any = { presence_ref: 'ref-1', user_id: 'user-1' };
    mockChannel.presenceState.mockReturnValue({ 'user-1': [peer] });

    let syncCb: (() => void) | undefined;
    mockChannel.on.mockImplementation((type: string, filter: any, cb: any) => {
      if (type === 'presence' && filter?.event === 'sync') syncCb = cb;
      return mockChannel;
    });

    const { result } = await renderHook(() => usePresence('room:1', { user_id: 'u1' }));

    await act(async () => { syncCb?.(); });

    expect(result.current.peers).toEqual([peer]);
  });

  test('cleans up: untracks on unmount; channel evicted after idle TTL', async () => {
    jest.useFakeTimers();
    const { unmount } = await renderHook(() => usePresence('room:cleanup', { user_id: 'u2' }));

    // Under fake timers a bare unmount() doesn't drain React's act() queue, so
    // the effect cleanup (which calls channel.untrack()) never runs. Wrap the
    // unmount in act(async) to flush cleanup.
    await act(async () => {
      unmount();
    });

    expect(mockChannel.untrack).toHaveBeenCalled();
    // Channel stays warm in the cache for the idle TTL before removeChannel fires.
    expect(supabase.removeChannel).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);

    jest.useRealTimers();
  });

  test('sets status to error on CHANNEL_ERROR', async () => {
    mockChannel.subscribe.mockImplementation((cb?: (s: string) => void) => {
      cb?.('CHANNEL_ERROR');
      return mockChannel;
    });

    const { result } = await renderHook(() => usePresence('room:err', { user_id: 'u3' }));

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  test('uses presenceCacheKey to namespace presence channels (no collision with broadcast cache)', async () => {
    await renderHook(() => usePresence('shared:room', { user_id: 'p1' }));
    // Sanity: presence is keyed separately from a broadcast-style "shared:room" name.
    expect(presenceCacheKey('shared:room', 'p1')).toBe('shared:room:presence:p1');
  });
});
