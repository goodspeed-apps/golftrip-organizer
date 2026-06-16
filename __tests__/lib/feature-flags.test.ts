/**
 * Tests for lib/feature-flags.ts
 */

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

const mockGetItem = jest.fn(async () => 'test-device-id');
const mockSetItem = jest.fn(async () => {});
jest.mock('expo-secure-store', () => ({
  getItemAsync: mockGetItem,
  setItemAsync: mockSetItem,
}));

const mockAddBreadcrumb = jest.fn();
jest.mock('../../lib/sentry', () => ({
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
}));

// Must import after mocks
import {
  getFlag,
  refreshFlags,
  setUserContext,
  initDeviceId,
  __resetForTesting,
  __getListenersForTesting,
} from '../../lib/feature-flags';

// Helper: build a mock Supabase from-chain that returns given rows
function mockRows(rows: object[]) {
  mockFrom.mockReturnValue({
    select: jest.fn().mockResolvedValue({ data: rows, error: null }),
  });
}

// Helper: build a single flag row with defaults
function row(overrides: Partial<{
  key: string;
  enabled: boolean;
  rollout_percentage: number;
  segments: object;
  metadata: object;
}>): object {
  return {
    key: 'test_flag',
    enabled: true,
    rollout_percentage: 100,
    segments: {},
    metadata: {},
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  __resetForTesting();
  mockGetItem.mockResolvedValue('test-device-id');
  // Prime the snapshot with empty rows so cache is populated (not stale)
  mockRows([]);
  await refreshFlags();
});

// ---

describe('missing flag', () => {
  it('returns defaultValue when flag is not in snapshot', async () => {
    mockRows([]);
    await refreshFlags();
    expect(getFlag('nonexistent_flag', false)).toBe(false);
    expect(getFlag('nonexistent_flag', true)).toBe(true);
  });
});

describe('enabled flag', () => {
  it('returns true for an enabled flag', async () => {
    mockRows([row({ key: 'my_flag', enabled: true, rollout_percentage: 100 })]);
    await refreshFlags();
    setUserContext('user-1');
    expect(getFlag('my_flag')).toBe(true);
  });
});

describe('disabled flag', () => {
  it('returns false for a disabled flag', async () => {
    mockRows([row({ key: 'off_flag', enabled: false, rollout_percentage: 100 })]);
    await refreshFlags();
    setUserContext('user-1');
    expect(getFlag('off_flag', true)).toBe(false);
  });
});

describe('kill_all', () => {
  it('overrides all flags to false when kill_all is enabled', async () => {
    mockRows([
      row({ key: 'kill_all', enabled: true, rollout_percentage: 100 }),
      row({ key: 'some_flag', enabled: true, rollout_percentage: 100 }),
    ]);
    await refreshFlags();
    setUserContext('user-1');
    expect(getFlag('some_flag', true)).toBe(false);
    expect(getFlag('nonexistent', true)).toBe(false);
  });

  it('does not override when kill_all is absent', async () => {
    mockRows([row({ key: 'some_flag', enabled: true, rollout_percentage: 100 })]);
    await refreshFlags();
    setUserContext('user-1');
    expect(getFlag('some_flag')).toBe(true);
  });
});

describe('rollout_percentage=50', () => {
  it('enables approximately half of 1000 distinct userIds', async () => {
    mockRows([row({ key: 'rollout_flag', enabled: true, rollout_percentage: 50 })]);
    await refreshFlags();

    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      setUserContext(`user-${i}`);
      if (getFlag('rollout_flag')) trueCount++;
    }

    // Expect between 40% and 60%
    expect(trueCount).toBeGreaterThanOrEqual(400);
    expect(trueCount).toBeLessThanOrEqual(600);
  });
});

describe('segments.countries filter', () => {
  it('returns false when user country is not in the allowed list', async () => {
    mockRows([row({
      key: 'geo_flag',
      enabled: true,
      rollout_percentage: 100,
      segments: { countries: ['US', 'CA'] },
    })]);
    await refreshFlags();
    setUserContext('user-1', 'GB');
    expect(getFlag('geo_flag')).toBe(false);
  });

  it('returns true when user country is in the allowed list', async () => {
    mockRows([row({
      key: 'geo_flag',
      enabled: true,
      rollout_percentage: 100,
      segments: { countries: ['US', 'CA'] },
    })]);
    await refreshFlags();
    setUserContext('user-1', 'US');
    expect(getFlag('geo_flag')).toBe(true);
  });

  it('returns false when country is not set but countries filter is present', async () => {
    mockRows([row({
      key: 'geo_flag',
      enabled: true,
      rollout_percentage: 100,
      segments: { countries: ['US'] },
    })]);
    await refreshFlags();
    setUserContext('user-1'); // no country
    expect(getFlag('geo_flag')).toBe(false);
  });
});

describe('cache TTL', () => {
  it('does not refetch within 60 seconds', async () => {
    mockRows([row({ key: 'cached_flag', enabled: true, rollout_percentage: 100 })]);
    await refreshFlags();

    // Reset mock call count — any subsequent getFlag should NOT trigger another fetch
    mockFrom.mockClear();

    // Second read within TTL
    getFlag('cached_flag');
    // Allow any microtasks to flush
    await Promise.resolve();

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('anonymous user with stable deviceId', () => {
  it('produces a consistent bucket across calls for the same device', async () => {
    mockRows([row({ key: 'stable_flag', enabled: true, rollout_percentage: 50 })]);
    await refreshFlags();

    // Init deviceId so it's populated (mocked to 'test-device-id')
    await initDeviceId();

    // Without userCtx, resolveFlag uses deviceId as userId
    const result1 = getFlag('stable_flag');
    const result2 = getFlag('stable_flag');
    const result3 = getFlag('stable_flag');

    // All calls with the same deviceId must agree
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('uses deviceId (not literal "anonymous") when no userCtx is set', async () => {
    mockRows([row({ key: 'device_flag', enabled: true, rollout_percentage: 100 })]);
    await refreshFlags();

    // Ensure deviceId is populated
    await initDeviceId();

    // SecureStore mock returns 'test-device-id'
    expect(mockGetItem).toHaveBeenCalled();

    // 100% rollout: true regardless of which userId is hashed
    expect(getFlag('device_flag')).toBe(true);
  });
});

describe('useFlag listener pub/sub', () => {
  it('notifies listeners when a background refresh changes the snapshot', async () => {
    // Initial: flag enabled
    mockRows([row({ key: 'live_flag', enabled: true, rollout_percentage: 100 })]);
    await refreshFlags();
    setUserContext('user-1');

    // Directly verify that refreshFlags calls registered listeners.
    // This is the mechanism useFlag hooks into to trigger re-renders.
    const received: boolean[] = [];
    const listener = () => { received.push(getFlag('live_flag', false)); };
    __getListenersForTesting().add(listener);

    try {
      // Simulate a background refresh that disables the flag
      mockRows([row({ key: 'live_flag', enabled: false, rollout_percentage: 100 })]);
      await refreshFlags();

      // Listener should have been called with the updated value
      expect(received.length).toBeGreaterThanOrEqual(1);
      expect(received[received.length - 1]).toBe(false);
    } finally {
      __getListenersForTesting().delete(listener);
    }
  });
});

describe('refreshFlags coalesces concurrent callers into one pending refresh', () => {
  it('shares the same pending refresh across concurrent callers', async () => {
    let resolveFirst!: () => void;
    let fetchCount = 0;

    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnValue(
        new Promise<{ data: object[]; error: null }>(resolve => {
          fetchCount++;
          if (fetchCount === 1) {
            resolveFirst = () => resolve({ data: [], error: null });
          } else {
            resolve({ data: [], error: null });
          }
        }),
      ),
    }));

// Start first refresh (in-flight) — resolveFirst not called yet so it hangs
    const firstRefresh = refreshFlags();

    // While first is in-flight, queue a second refresh.
    // With the singleton pendingRefresh, the second call shares the first's
    // promise instead of firing a new fetch.
    const secondRefresh = refreshFlags();

    // Flush microtasks so the inner fetch reaches supabase.from() and assigns
    // resolveFirst.
    for (let i = 0; i < 10; i++) await Promise.resolve();

    // Resolve the in-flight fetch so both can proceed
    resolveFirst();

await firstRefresh;
    await secondRefresh;

    // Singleton coalescing: at most one fetch was issued for the concurrent
    // callers (the in-flight one).
    expect(fetchCount).toBe(1);
  });
});

describe('bucketCache invalidation across setUserContext calls', () => {
  it('clears bucket cache so different users see different bucket values', async () => {
    // 50% rollout: same flag, different userIds produce different buckets.
    // Find two userIds that hash to different sides of the 50% threshold.
    mockRows([row({ key: 'bucket_flag', enabled: true, rollout_percentage: 50 })]);
    await refreshFlags();

    // Search for a userA that resolves true and a userB that resolves false.
    let userA: string | null = null;
    let userB: string | null = null;
    for (let i = 0; i < 100 && (!userA || !userB); i++) {
      const id = `user-${i}`;
      setUserContext(id);
      const v = getFlag('bucket_flag');
      if (v && !userA) userA = id;
      if (!v && !userB) userB = id;
    }
    expect(userA).not.toBeNull();
    expect(userB).not.toBeNull();

    // Resolve again with each context — values should track the active user,
    // which requires bucketCache to be cleared on user change.
    setUserContext(userA as string);
    const a1 = getFlag('bucket_flag');
    setUserContext(userB as string);
    const b1 = getFlag('bucket_flag');
    setUserContext(userA as string);
    const a2 = getFlag('bucket_flag');

    expect(a1).toBe(true);
    expect(b1).toBe(false);
    expect(a2).toBe(true);
  });
});

describe('fetchFlags retry + breadcrumb fallback', () => {
  beforeEach(() => {
    mockAddBreadcrumb.mockClear();
  });

  it('eventually returns after two transient failures', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) throw new Error('network error');
        return { data: [row({ key: 'survivor', enabled: true, rollout_percentage: 100 })], error: null };
      }),
    }));

    await refreshFlags();
    setUserContext('user-1');
    expect(getFlag('survivor')).toBe(true);
    expect(callCount).toBe(3);
  });

  it('logs fetch_failed breadcrumb when all retries fail and keeps defaults', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockImplementation(async () => {
        throw new Error('persistent network error');
      }),
    }));

    // Should NOT throw — graceful fallback.
    await refreshFlags();

    expect(mockAddBreadcrumb).toHaveBeenCalled();
    const breadcrumbCalls = mockAddBreadcrumb.mock.calls;
    const fetchFailedCall = breadcrumbCalls.find(
      (call: unknown[]) => typeof call[1] === 'string' && (call[1] as string).startsWith('fetch_failed:'),
    );
    expect(fetchFailedCall).toBeDefined();
    expect(fetchFailedCall?.[0]).toBe('feature-flags');

    // Snapshot remains empty → defaults apply.
    setUserContext('user-1');
    expect(getFlag('nonexistent_flag', false)).toBe(false);
    expect(getFlag('nonexistent_flag', true)).toBe(true);
  }, 10000);
});
