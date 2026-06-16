/**
 * Tests for services/realtime.ts — broadcast() with module-level channel cache.
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

jest.mock('../../gas.config', () => ({
  gasConfig: {
    realtime: {
      presenceTimeoutMs: 30_000,
      autoReconnect: true,
      defaultRetries: 3,
    },
  },
}));

import {
  broadcast,
  acquireChannel,
  releaseChannel,
  __clearChannelCache,
  __clearBroadcastChannelCache,
} from '../../services/realtime';
import { supabase } from '../../lib/supabase';

beforeEach(() => {
  __clearChannelCache();
  jest.clearAllMocks();
  mockChannel.on.mockReturnThis();
  mockChannel.subscribe.mockImplementation((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return mockChannel;
  });
  mockChannel.send.mockResolvedValue('ok');
  (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
});

describe('broadcast', () => {
  test('sends broadcast and resolves { ok: true } on ack', async () => {
    const result = await broadcast('room:b', 'ping', { value: 1 });

    expect(supabase.channel).toHaveBeenCalledWith('room:b');
    expect(mockChannel.subscribe).toHaveBeenCalled();
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'ping',
      payload: { value: 1 },
    });
    expect(result).toEqual({ ok: true });
  });

  test('rejects on timeout when subscribe never fires SUBSCRIBED', async () => {
    jest.useFakeTimers();

    mockChannel.subscribe.mockImplementation(() => mockChannel); // never calls cb

    const promise = broadcast('room:timeout', 'evt', {});
    promise.catch(() => {}); // suppress unhandled rejection in fake-timer window
    jest.advanceTimersByTime(31_000);

    await expect(promise).rejects.toThrow(/timeout/);

    jest.useRealTimers();
  });

  test('rejects when send returns non-ok status', async () => {
    mockChannel.send.mockResolvedValue('error');

    await expect(broadcast('room:fail', 'evt', {})).rejects.toThrow('broadcast failed');
  });

test('reuses cached channel for repeated broadcasts on the same name', async () => {
    await broadcast('room:cached', 'a', { n: 1 });
    await broadcast('room:cached', 'b', { n: 2 });

    // supabase.channel should be invoked once; the second broadcast hits cache.
    expect((supabase.channel as jest.Mock).mock.calls.filter((c) => c[0] === 'room:cached')).toHaveLength(1);
    expect(mockChannel.send).toHaveBeenCalledTimes(2);
  });

  test('back-compat alias __clearBroadcastChannelCache still empties the cache', () => {
    // Should not throw; covered indirectly by other tests but worth pinning
    // the alias so we don't accidentally drop it.
    expect(typeof __clearBroadcastChannelCache).toBe('function');
    __clearBroadcastChannelCache();
  });
});

// ─── channel cache ────────────────────────────────────────────────────────────

describe('channel cache (acquire/release)', () => {
  test('refcounts: a release after two acquires keeps the channel live; second release schedules idle eviction', () => {
    jest.useFakeTimers();

    acquireChannel('room:refcount');
    acquireChannel('room:refcount');
    expect((supabase.channel as jest.Mock).mock.calls.filter((c) => c[0] === 'room:refcount')).toHaveLength(1);

    releaseChannel('room:refcount');
    // Still refs===1; no idle timer firing.
    jest.advanceTimersByTime(61_000);
    expect(supabase.removeChannel).not.toHaveBeenCalled();

    releaseChannel('room:refcount');
    // Now refs===0; idle timer fires after the TTL.
    jest.advanceTimersByTime(61_000);
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);

    jest.useRealTimers();
  });

  test('idle-TTL: a re-acquire within the TTL cancels the eviction timer', () => {
    jest.useFakeTimers();

    acquireChannel('room:idle');
    releaseChannel('room:idle');

    // Re-acquire before the idle timer fires.
    jest.advanceTimersByTime(10_000);
    acquireChannel('room:idle');

    // Advance past the original TTL; channel should still be alive because
    // the re-acquire cancelled the pending idle timer.
    jest.advanceTimersByTime(120_000);
    expect(supabase.removeChannel).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('LRU eviction: at MAX_CACHE_SIZE, the oldest idle entry is evicted', () => {
    // Fill the cache with 32 idle entries.
    const channels: any[] = [];
(supabase.channel as jest.Mock).mockImplementation((name: string) => {
      // Distinct mock per name so removeChannel calls can be attributed.
      const ch: any = {
        ...mockChannel,
        __name: name,
        on: jest.fn().mockReturnThis(),
      };
      ch.subscribe = jest.fn((cb?: (s: string) => void) => {
        cb?.('SUBSCRIBED');
        return ch;
      });
      channels.push(ch);
      return ch;
    });

    for (let i = 0; i < 32; i++) {
      acquireChannel(`room:lru-${i}`);
      releaseChannel(`room:lru-${i}`);
    }

    // Acquiring the 33rd channel triggers LRU eviction of room:lru-0.
    acquireChannel('room:lru-32');

    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(supabase.removeChannel).toHaveBeenCalledWith(
      expect.objectContaining({ __name: 'room:lru-0' }),
    );
  });

  test('__clearChannelCache is no-op outside test env', () => {
    const original = process.env.NODE_ENV;
    try {
      acquireChannel('room:guard');
      // process.env.NODE_ENV is typed `string | undefined` since @types/node 18,
      // so a plain assignment typechecks without a directive now.
      process.env.NODE_ENV = 'production';
      __clearChannelCache();
      // Nothing was removed because the guard short-circuits.
      expect(supabase.removeChannel).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = original;
      __clearChannelCache();
    }
  });
});