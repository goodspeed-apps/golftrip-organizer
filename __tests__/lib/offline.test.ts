/**
 * Tests for lib/offline.ts
 * Focused on exports and constants (detailed tests in lib.test.ts)
 */

const store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve(); }),
    removeItem: jest.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  },
}));
jest.mock('../../lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn() }));

import {
  cacheQuery, getCached, clearCache,
  queueMutation, flushQueue, getQueueLength,
  STALE_THRESHOLD_MS, SHORT_CACHE_MS, LONG_CACHE_MS,
} from '../../lib/offline';

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe('cache operations', () => {
  test('round-trip cache write and read', async () => {
    await cacheQuery('test', { value: 42 }, 60000);
    const result = await getCached<{ value: number }>('test');
    expect(result).not.toBeNull();
    expect(result!.data.value).toBe(42);
    expect(result!.stale).toBe(false);
  });

  test('clearCache removes entry', async () => {
    await cacheQuery('tmp', 'data', 60000);
    await clearCache('tmp');
    const result = await getCached('tmp');
    expect(result).toBeNull();
  });

  test('expired cache returns stale=true', async () => {
    // Write with 50ms TTL, wait 60ms — age between 1× and 2× TTL
    await cacheQuery('expire-test', 'old-data', 50);
    await new Promise(r => setTimeout(r, 60));
    const result = await getCached<string>('expire-test');
    expect(result).not.toBeNull();
    expect(result!.stale).toBe(true);
  });

  test('cache evicted after 2× TTL', async () => {
    // Write with 10ms TTL, wait 30ms — age > 2×10ms so evicted
    await cacheQuery('evict-test', 'old-data', 10);
    await new Promise(r => setTimeout(r, 30));
    const result = await getCached<string>('evict-test');
    expect(result).toBeNull();
  });
});

describe('mutation queue', () => {
  test('queue and flush round-trip', async () => {
    await queueMutation({ id: '1', endpoint: '/test', method: 'POST', body: {} });
    expect(await getQueueLength()).toBe(1);
    await flushQueue(jest.fn().mockResolvedValue(undefined));
    expect(await getQueueLength()).toBe(0);
  });

  test('empty queue flush is safe', async () => {
    await flushQueue(jest.fn());
    expect(await getQueueLength()).toBe(0);
  });
});

describe('flush lock prevents concurrent execution', () => {
  test('second concurrent flushQueue returns early (0 executed)', async () => {
    // Make executor slow so we can trigger concurrent calls
    const slowExecutor = jest.fn(() => new Promise<void>(resolve => setTimeout(resolve, 50)));

    await queueMutation({ id: '1', endpoint: '/a', method: 'POST', body: {} });
    await queueMutation({ id: '2', endpoint: '/b', method: 'POST', body: {} });

    // Start first flush (will be slow)
    const first = flushQueue(slowExecutor);
    // Immediately start second flush — should be blocked by lock
    const second = flushQueue(jest.fn());

    const [r1, r2] = await Promise.all([first, second]);
    // First should execute items, second should return zeros
    expect(r1.executed).toBeGreaterThan(0);
    expect(r2.executed).toBe(0);
    expect(r2.failed).toBe(0);
    expect(r2.dropped).toBe(0);
  });
});

describe('analytics sampling', () => {
  test('cache events are sampled at 10%', async () => {
    const { captureEvent: mockCapture } = require('../../lib/posthog');
    mockCapture.mockClear();

    // Seed Math.random to always return 0.05 (< 0.1, so should sample)
    const origRandom = Math.random;
    Math.random = () => 0.05;

    await getCached<string>('nonexistent-key');
    expect(mockCapture).toHaveBeenCalledWith('cache_miss', { key: 'nonexistent-key' });

    // Seed Math.random to always return 0.5 (> 0.1, so should NOT sample)
    mockCapture.mockClear();
    Math.random = () => 0.5;

    await getCached<string>('another-nonexistent');
    expect(mockCapture).not.toHaveBeenCalled();

    Math.random = origRandom;
  });
});

describe('queue size limits', () => {
  test('queue overflow drops oldest entries beyond MAX_QUEUE_SIZE', async () => {
    // Queue 105 items (MAX_QUEUE_SIZE is 100)
    for (let i = 0; i < 105; i++) {
      await queueMutation({ id: String(i), endpoint: `/test-${i}`, method: 'POST', body: {} });
    }
    const length = await getQueueLength();
    expect(length).toBeLessThanOrEqual(100);
  });
});

describe('constants', () => {
  test('STALE_THRESHOLD_MS is 2 hours', () => {
    expect(STALE_THRESHOLD_MS).toBe(7200000);
  });
  test('SHORT_CACHE_MS is 5 minutes', () => {
    expect(SHORT_CACHE_MS).toBe(300000);
  });
  test('LONG_CACHE_MS is 24 hours', () => {
    expect(LONG_CACHE_MS).toBe(86400000);
  });
});
