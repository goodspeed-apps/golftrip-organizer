/**
 * GAS Template — Lib & Service Unit Tests
 *
 * Tests for offline.ts, validation.ts, and core utilities.
 * Uses in-memory AsyncStorage mock, jest.fn() for analytics.
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────

// In-memory AsyncStorage mock
const store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve(); }),
    removeItem: jest.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  },
}));

jest.mock('../lib/posthog', () => ({
  captureEvent: jest.fn(),
}));

jest.mock('../lib/sentry', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {},
}));

// Mock __DEV__ for offline.ts
(global as any).__DEV__ = true;

import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureEvent } from '../lib/posthog';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('lib/offline — Cache Operations', () => {
  // Import dynamically to ensure mocks are in place
  let cacheQuery: typeof import('../lib/offline').cacheQuery;
  let getCached: typeof import('../lib/offline').getCached;
  let clearCache: typeof import('../lib/offline').clearCache;

  beforeAll(async () => {
    const mod = await import('../lib/offline');
    cacheQuery = mod.cacheQuery;
    getCached = mod.getCached;
    clearCache = mod.clearCache;
  });

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  test('cacheQuery stores data and getCached retrieves it', async () => {
    await cacheQuery('users', { id: 1, name: 'Alice' }, 60000);
    const result = await getCached<{ id: number; name: string }>('users');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ id: 1, name: 'Alice' });
    expect(result!.stale).toBe(false);
  });

  test('getCached returns null for missing key (cache miss)', async () => {
    const result = await getCached('nonexistent');
    expect(result).toBeNull();
    expect(captureEvent).toHaveBeenCalledWith('cache_miss', { key: 'nonexistent' });
  });

  test('getCached returns stale=true for expired TTL', async () => {
    // Store with already-expired timestamp
    const key = '@my-app:cache:old';
    store.set(key, JSON.stringify({ data: 'test', timestamp: Date.now() - 120000, ttlMs: 60000 }));
    const result = await getCached('old');
    expect(result).not.toBeNull();
    expect(result!.stale).toBe(true);
  });

  test('getCached evicts entries older than 2× TTL', async () => {
    const key = '@my-app:cache:ancient';
    store.set(key, JSON.stringify({ data: 'test', timestamp: Date.now() - 240000, ttlMs: 60000 }));
    const result = await getCached('ancient');
    expect(result).toBeNull();
    expect(captureEvent).toHaveBeenCalledWith('cache_evicted', expect.objectContaining({ key: 'ancient' }));
  });

  test('getCached handles corrupted JSON', async () => {
    const key = '@my-app:cache:bad';
    store.set(key, '{not valid json!!!');
    const result = await getCached('bad');
    expect(result).toBeNull();
    expect(captureEvent).toHaveBeenCalledWith('cache_corrupted', { key: 'bad' });
    expect(store.has(key)).toBe(false); // corrupted entry deleted
  });

  test('clearCache removes entry', async () => {
    await cacheQuery('temp', 'data', 60000);
    await clearCache('temp');
    const result = await getCached('temp');
    expect(result).toBeNull();
  });
});

describe('lib/offline — Mutation Queue', () => {
  let queueMutation: typeof import('../lib/offline').queueMutation;
  let flushQueue: typeof import('../lib/offline').flushQueue;
  let getQueueLength: typeof import('../lib/offline').getQueueLength;

  beforeAll(async () => {
    const mod = await import('../lib/offline');
    queueMutation = mod.queueMutation;
    flushQueue = mod.flushQueue;
    getQueueLength = mod.getQueueLength;
  });

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  test('queueMutation adds to queue', async () => {
    await queueMutation({ id: '1', endpoint: '/api/test', method: 'POST', body: { x: 1 } });
    expect(await getQueueLength()).toBe(1);
  });

  test('queue caps at 100 items', async () => {
    for (let i = 0; i < 110; i++) {
      await queueMutation({ id: String(i), endpoint: '/api/test', method: 'POST', body: {} });
    }
    expect(await getQueueLength()).toBe(100);
    expect(captureEvent).toHaveBeenCalledWith('offline_queue_overflow', expect.objectContaining({ max: 100 }));
  });

  test('flushQueue executes and removes successful mutations', async () => {
    await queueMutation({ id: '1', endpoint: '/api/a', method: 'POST', body: {} });
    await queueMutation({ id: '2', endpoint: '/api/b', method: 'POST', body: {} });

    const executor = jest.fn().mockResolvedValue(undefined);
    await flushQueue(executor);

    expect(executor).toHaveBeenCalledTimes(2);
    expect(await getQueueLength()).toBe(0);
  });

  test('flushQueue retries failed mutations up to 5 times', async () => {
    await queueMutation({ id: '1', endpoint: '/api/fail', method: 'POST', body: {} });

    const executor = jest.fn().mockRejectedValue(new Error('Network error'));

    // First 5 attempts: mutation stays in queue with incrementing retries
    for (let i = 0; i < 5; i++) {
      await flushQueue(executor);
      expect(await getQueueLength()).toBe(1);
    }

    // 6th attempt: mutation dropped (retries reached 5)
    await flushQueue(executor);
    expect(await getQueueLength()).toBe(0);
    expect(captureEvent).toHaveBeenCalledWith('offline_mutation_dropped', expect.objectContaining({ endpoint: '/api/fail' }));
  });

  test('flushQueue handles corrupted queue JSON', async () => {
    store.set('@my-app:write_queue', 'not json');
    await flushQueue(jest.fn());
    expect(captureEvent).toHaveBeenCalledWith('offline_queue_corrupted', { action: 'flush_queue' });
  });

  test('getQueueLength handles corrupted queue JSON', async () => {
    store.set('@my-app:write_queue', '{broken');
    const length = await getQueueLength();
    expect(length).toBe(0);
    expect(captureEvent).toHaveBeenCalledWith('offline_queue_corrupted', { action: 'get_queue_length' });
  });
});

describe('lib/validation — Zod Schemas', () => {
  let validate: typeof import('../lib/validation').validate;
  let emailSchema: typeof import('../lib/validation').emailSchema;
  let passwordSchema: typeof import('../lib/validation').passwordSchema;
  let displayNameSchema: typeof import('../lib/validation').displayNameSchema;
  let urlSchema: typeof import('../lib/validation').urlSchema;

  beforeAll(async () => {
    const mod = await import('../lib/validation');
    validate = mod.validate;
    emailSchema = mod.emailSchema;
    passwordSchema = mod.passwordSchema;
    displayNameSchema = mod.displayNameSchema;
    urlSchema = mod.urlSchema;
  });

  // Email
  test('emailSchema accepts valid email', () => {
    const result = validate(emailSchema, 'user@example.com');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('user@example.com');
  });

  test('emailSchema rejects invalid email', () => {
    const result = validate(emailSchema, 'not-an-email');
    expect(result.success).toBe(false);
  });

  test('emailSchema normalizes to lowercase', () => {
    const result = validate(emailSchema, 'User@EXAMPLE.COM');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('user@example.com');
  });

  // Password
  test('passwordSchema accepts strong password', () => {
    const result = validate(passwordSchema, 'MyP@ss123');
    expect(result.success).toBe(true);
  });

  test('passwordSchema rejects short password', () => {
    const result = validate(passwordSchema, 'Ab1');
    expect(result.success).toBe(false);
  });

  test('passwordSchema rejects password without uppercase', () => {
    const result = validate(passwordSchema, 'mypass123');
    expect(result.success).toBe(false);
  });

  test('passwordSchema rejects password without lowercase', () => {
    const result = validate(passwordSchema, 'MYPASS123');
    expect(result.success).toBe(false);
  });

  test('passwordSchema rejects password without number', () => {
    const result = validate(passwordSchema, 'MyPassword');
    expect(result.success).toBe(false);
  });

  // Display name
  test('displayNameSchema accepts valid name', () => {
    const result = validate(displayNameSchema, 'Alice');
    expect(result.success).toBe(true);
  });

  test('displayNameSchema rejects single character', () => {
    const result = validate(displayNameSchema, 'A');
    expect(result.success).toBe(false);
  });

  test('displayNameSchema rejects too long name', () => {
    const result = validate(displayNameSchema, 'A'.repeat(51));
    expect(result.success).toBe(false);
  });

  // URL
  test('urlSchema accepts valid URL', () => {
    const result = validate(urlSchema, 'https://example.com');
    expect(result.success).toBe(true);
  });

  test('urlSchema rejects invalid URL', () => {
    const result = validate(urlSchema, 'not a url');
    expect(result.success).toBe(false);
  });
});

describe('lib/offline — Constants', () => {
  test('STALE_THRESHOLD_MS is 2 hours', async () => {
    const { STALE_THRESHOLD_MS } = await import('../lib/offline');
    expect(STALE_THRESHOLD_MS).toBe(2 * 60 * 60 * 1000);
  });

  test('SHORT_CACHE_MS is 5 minutes', async () => {
    const { SHORT_CACHE_MS } = await import('../lib/offline');
    expect(SHORT_CACHE_MS).toBe(5 * 60 * 1000);
  });

  test('LONG_CACHE_MS is 24 hours', async () => {
    const { LONG_CACHE_MS } = await import('../lib/offline');
    expect(LONG_CACHE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
