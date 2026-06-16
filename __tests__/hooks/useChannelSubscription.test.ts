/**
 * Tests for hooks/useChannelSubscription.ts — Realtime broadcast subscription.
 * The hook routes through the shared services/realtime channel cache.
 */

const mockChannel: Record<string, any> = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return mockChannel;
  }),
  send: jest.fn().mockResolvedValue('ok'),
  unsubscribe: jest.fn(),
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn().mockResolvedValue('ok'),
  },
}));

// Provide ONLY the gas.config fields the implementation reads, pinned to the
// template values the tests expect. A generated app can customise its own
// gas.config (different realtime timeouts, i18n locales, etc.); mocking the
// module here keeps this suite deterministic regardless of those overrides.
// services/realtime reads `gasConfig.realtime?.presenceTimeoutMs`.
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

import { renderHook, act, cleanup } from '@testing-library/react-native';
import { useChannelSubscription } from '../../hooks/useChannelSubscription';
import { supabase } from '../../lib/supabase';
import { __clearChannelCache } from '../../services/realtime';

beforeEach(() => {
  __clearChannelCache();
  jest.clearAllMocks();
  mockChannel.on.mockReturnThis();
  mockChannel.subscribe.mockImplementation((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return mockChannel;
  });
  (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
});

// Unmount any still-rendered hook after each test so a leftover React act()
// scope can't overlap the next test's render (notably across the fake-timer
// boundary in the cleanup test). Runs under real timers.
afterEach(() => {
  cleanup();
});

describe('useChannelSubscription', () => {
  test('forwards broadcast events to handler', async () => {
    const handler = jest.fn();
    let broadcastCb: ((msg: any) => void) | undefined;

    mockChannel.on.mockImplementation((type: string, filter: any, cb: any) => {
      if (type === 'broadcast' && filter?.event === 'message') broadcastCb = cb;
      return mockChannel;
    });

    await renderHook(() => useChannelSubscription('chat:1', 'message', handler));

    expect(supabase.channel).toHaveBeenCalledWith('chat:1');
    expect(mockChannel.subscribe).toHaveBeenCalled();

    await act(async () => { broadcastCb?.({ payload: { text: 'hello' } }); });

    expect(handler).toHaveBeenCalledWith({ text: 'hello' });
  });

  test('cleans up: releases the cache ref on unmount; channel is evicted after idle TTL', async () => {
    jest.useFakeTimers();
    const { unmount } = await renderHook(() =>
      useChannelSubscription('chat:cleanup', 'evt', jest.fn()),
    );

    // Wrap unmount in act() so React drains the effect-cleanup queue under
    // fake timers — otherwise releaseChannel() (which schedules the idle
    // eviction timer) may not have run when we advance the clock below.
    await act(async () => {
      unmount();
    });

    // The hook routes through the channel cache, so the underlying channel
    // isn't torn down immediately on unmount — it stays warm for the idle
    // TTL window (60s) so a subsequent mount can re-use the WS. After the
    // idle timer fires, the cache evicts and calls removeChannel.
    expect(supabase.removeChannel).not.toHaveBeenCalled();
    // Advancing fake timers fires the idle eviction callback; wrap in act()
    // so the resulting React work settles and removeChannel is observable.
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);

    jest.useRealTimers();
  });

  test('re-mount on the same channel reuses the cached underlying channel', async () => {
    const handler = jest.fn();
    const { unmount } = await renderHook(() => useChannelSubscription('chat:reuse', 'evt', handler));
    unmount();
    await renderHook(() => useChannelSubscription('chat:reuse', 'evt', handler));

    // supabase.channel was created once; the second mount hit the warm cache.
    expect((supabase.channel as jest.Mock).mock.calls.filter((c) => c[0] === 'chat:reuse')).toHaveLength(1);
  });
});
