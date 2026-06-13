import { renderHook, act } from '@testing-library/react-native';
import { flushPromises } from '../setup';

let netInfoListener: ((state: { isConnected: boolean }) => void) | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((cb: (state: { isConnected: boolean }) => void) => {
    netInfoListener = cb;
    return jest.fn(() => { netInfoListener = null; });
  }),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Pin gas.config to the template values the implementation reads, so a
// generated app that customizes its own gasConfig (e.g. a different
// defaultBackgroundSyncInterval) still passes these tests. Only the fields the
// hook actually consumes need real values; the rest are harmless placeholders.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    app: { slug: 'test-app' },
    growth: { defaultBackgroundSyncInterval: 60_000 },
    encryptedStorage: { offlineQueue: false },
    auth: { failedAttemptsBeforeLockMs: 0, maxFailedAttempts: 0 },
    sentry: { dsn: '' },
    analytics: { posthog: { writeKey: '' } },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

jest.mock('../../lib/offline', () => ({
  queueMutation: jest.fn().mockResolvedValue(undefined),
  flushQueue: jest.fn().mockResolvedValue({ executed: 0, failed: 0, dropped: 0 }),
}));

import { useBackgroundSync } from '../../hooks/useBackgroundSync';

beforeEach(() => {
  netInfoListener = null;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('useBackgroundSync', () => {
  test('runs initial sync and sets data on mount', async () => {
    const query = jest.fn().mockResolvedValue({ count: 42 });

    const { result } = await renderHook(() =>
      useBackgroundSync({ query })
    );

    await act(async () => { await flushPromises(); });

    expect(query).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ count: 42 });
    expect(result.current.error).toBeNull();
  });

  test('sets error state when query rejects', async () => {
    const query = jest.fn().mockRejectedValue(new Error('network failure'));

    const { result } = await renderHook(() =>
      useBackgroundSync({ query })
    );

    await act(async () => { await flushPromises(); });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('network failure');
  });

  test('invokes onConflict resolver when local state exists', async () => {
    const remote = { value: 'remote' };
    const local = { value: 'local' };
    const merged = { value: 'merged' };
    // Defer the query so the initial mount-sync stays pending until we have
    // established local state. With an immediately-resolved mock the mount
    // sync settles inside the renderHook act() flush and takes the no-local
    // branch, so onConflict would never fire.
    let resolveQuery!: (v: typeof remote) => void;
    const query = jest.fn(
      () => new Promise<typeof remote>(res => { resolveQuery = res; })
    );
    const onConflict = jest.fn().mockReturnValue(merged);

    const { result } = await renderHook(() =>
      useBackgroundSync({ query, onConflict })
    );

    // Set local state while the initial sync is still in-flight.
    await act(async () => { result.current.setLocal(local); });

    // Now release the remote response so the conflict resolver sees both.
    await act(async () => {
      resolveQuery(remote);
      await flushPromises();
    });

    expect(onConflict).toHaveBeenCalledWith(local, remote);
    expect(result.current.data).toEqual(merged);
  });

  test('triggers re-sync when NetInfo reports reconnection', async () => {
    const query = jest.fn().mockResolvedValue({ ok: true });

    await renderHook(() => useBackgroundSync({ query }));

    await act(async () => { await flushPromises(); });
    expect(query).toHaveBeenCalledTimes(1);

    await act(async () => {
      netInfoListener?.({ isConnected: true });
      await flushPromises();
    });

    expect(query).toHaveBeenCalledTimes(2);
  });

  test('does not sync when enabled is false', async () => {
    const query = jest.fn().mockResolvedValue({ ok: true });

    await renderHook(() => useBackgroundSync({ query, enabled: false }));

    await act(async () => { await flushPromises(); });

    expect(query).not.toHaveBeenCalled();
  });
});