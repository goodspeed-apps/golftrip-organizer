/**
 * Tests for services/push.ts
 *
 * Covers:
 * - registerForPush: success, permission denied, no user session
 * - unregister
 * - updatePreferences
 * - getPreferences
 * - initPushHandlers: tap routing with valid/invalid deep links
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetCurrentUserId = jest.fn();
const mockSupabaseFrom = jest.fn();
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockDelete = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn().mockResolvedValue({ error: null });
const mockSelect = jest.fn();
const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockRouterPush = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
  getCurrentUserId: mockGetCurrentUserId,
}));

jest.mock('expo-router', () => ({
  router: { push: mockRouterPush },
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test-token]' }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

jest.mock('expo-device', () => ({
  modelName: 'iPhone 15',
  isDevice: true,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../../lib/sentry', () => ({
  captureException: jest.fn(),
}));

jest.mock('../../lib/posthog', () => ({
  captureEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/retry', () => ({
  retryWithBackoff: jest.fn((fn) => fn()),
  isTransientNon4xxError: jest.fn(() => true),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  registerForPush,
  unregister,
  updatePreferences,
  getPreferences,
  initPushHandlers,
  type NotificationPreferences,
} from '../../services/push';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications = require('expo-notifications');

// ─── Setup ────────────────────────────────────────────────────────────────────

function makeChain() {
  const chain: Record<string, jest.Mock> = {
    upsert: mockUpsert,
    delete: mockDelete,
    eq: mockEq,
    update: mockUpdate,
    select: mockSelect,
    single: mockSingle,
  };
  chain.delete = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.select = jest.fn(() => chain);
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.upsert = jest.fn().mockResolvedValue({ error: null });
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  const chain = makeChain();
  mockSupabaseFrom.mockReturnValue(chain);
  mockGetCurrentUserId.mockResolvedValue('user-123');
  Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token]' });
});

// ─── registerForPush ─────────────────────────────────────────────────────────

describe('registerForPush', () => {
  it('returns expo push token on success', async () => {
    const chain = makeChain();
    mockSupabaseFrom.mockReturnValue(chain);

    const token = await registerForPush();

    expect(token).toBe('ExponentPushToken[test-token]');
    expect(mockSupabaseFrom).toHaveBeenCalledWith('push_tokens');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        expo_push_token: 'ExponentPushToken[test-token]',
        platform: 'ios',
      }),
      expect.any(Object),
    );
  });

  it('returns null when permission is denied', async () => {
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const token = await registerForPush();

    expect(token).toBeNull();
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('returns null when there is no user session', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const token = await registerForPush();

    expect(token).toBeNull();
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });
});

// ─── unregister ──────────────────────────────────────────────────────────────

describe('unregister', () => {
  it('deletes the push_tokens row for the current token', async () => {
    const chain = makeChain();
    mockSupabaseFrom.mockReturnValue(chain);

    await unregister();

    expect(mockSupabaseFrom).toHaveBeenCalledWith('push_tokens');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('expo_push_token', 'ExponentPushToken[test-token]');
  });
});

// ─── updatePreferences ───────────────────────────────────────────────────────

describe('updatePreferences', () => {
  it('updates preferences for the current token', async () => {
    const chain = makeChain();
    mockSupabaseFrom.mockReturnValue(chain);

    const prefs: NotificationPreferences = {
      transactional: true,
      product: false,
      marketing: false,
    };

    await updatePreferences(prefs);

    expect(mockSupabaseFrom).toHaveBeenCalledWith('push_tokens');
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: prefs }),
    );
    expect(chain.eq).toHaveBeenCalledWith('expo_push_token', 'ExponentPushToken[test-token]');
  });
});

// ─── getPreferences ──────────────────────────────────────────────────────────

describe('getPreferences', () => {
  it('returns stored preferences when row exists', async () => {
    const storedPrefs: NotificationPreferences = {
      transactional: true,
      product: true,
      marketing: true,
    };
    const chain = makeChain();
    chain.single = jest.fn().mockResolvedValue({ data: { preferences: storedPrefs }, error: null });
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    mockSupabaseFrom.mockReturnValue(chain);

    const prefs = await getPreferences();

    expect(prefs).toEqual(storedPrefs);
  });

  it('returns defaults when no row exists', async () => {
    const chain = makeChain();
    chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    mockSupabaseFrom.mockReturnValue(chain);

    const prefs = await getPreferences();

    expect(prefs).toEqual({
      transactional: true,
      product: true,
      marketing: false,
    });
  });
});

// ─── initPushHandlers ────────────────────────────────────────────────────────

describe('initPushHandlers', () => {
  it('routes to valid deep link on notification tap', () => {
    let tapHandler: ((r: unknown) => void) | undefined;
    const mockRemove = jest.fn();

    Notifications.addNotificationResponseReceivedListener.mockImplementation(
      (fn: (r: unknown) => void) => {
        tapHandler = fn;
        return { remove: mockRemove };
      },
    );

    const unsubscribe = initPushHandlers();

    expect(tapHandler).toBeDefined();

    // Simulate tap with valid deep link
    tapHandler!({
      notification: {
        request: {
          content: {
            data: { deepLink: '/home/profile' },
          },
        },
      },
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/home/profile');

    unsubscribe();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('does NOT route for deep link missing leading slash', () => {
    let tapHandler: ((r: unknown) => void) | undefined;

    Notifications.addNotificationResponseReceivedListener.mockImplementation(
      (fn: (r: unknown) => void) => {
        tapHandler = fn;
        return { remove: jest.fn() };
      },
    );

    initPushHandlers();

    tapHandler!({
      notification: {
        request: {
          content: {
            data: { deepLink: 'home/profile' }, // missing leading slash
          },
        },
      },
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('does NOT route for deep link containing path traversal', () => {
    let tapHandler: ((r: unknown) => void) | undefined;

    Notifications.addNotificationResponseReceivedListener.mockImplementation(
      (fn: (r: unknown) => void) => {
        tapHandler = fn;
        return { remove: jest.fn() };
      },
    );

    initPushHandlers();

    tapHandler!({
      notification: {
        request: {
          content: {
            data: { deepLink: '/home/../secret' },
          },
        },
      },
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('does NOT route when deepLink is absent', () => {
    let tapHandler: ((r: unknown) => void) | undefined;

    Notifications.addNotificationResponseReceivedListener.mockImplementation(
      (fn: (r: unknown) => void) => {
        tapHandler = fn;
        return { remove: jest.fn() };
      },
    );

    initPushHandlers();

    tapHandler!({
      notification: {
        request: {
          content: {
            data: {},
          },
        },
      },
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('returns unsubscribe function that calls remove', () => {
    const mockRemove = jest.fn();
    Notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: mockRemove });

    const unsubscribe = initPushHandlers();
    unsubscribe();

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
