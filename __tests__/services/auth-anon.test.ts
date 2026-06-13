/**
 * Tests for services/auth.ts — anonymous auth and account upgrade.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSignInAnonymously = jest.fn();
const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockGetSession = jest.fn();
const mockLinkIdentity = jest.fn();
const mockFunctionsInvoke = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInAnonymously: mockSignInAnonymously,
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
      getSession: mockGetSession,
      linkIdentity: mockLinkIdentity,
    },
    functions: {
      invoke: mockFunctionsInvoke,
    },
  },
}));

jest.mock('../../lib/sentry', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('../../lib/posthog', () => ({
  captureEvent: jest.fn(),
}));

// Disable retry delays in tests
jest.mock('../../lib/retry', () => {
  const actual = jest.requireActual<typeof import('../../lib/retry')>('../../lib/retry');
  return {
    ...actual,
    retryWithBackoff: (fn: () => Promise<unknown>) => fn(),
  };
});

const mockFetch = jest.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

jest.mock('../../gas.config', () => ({
  gasConfig: {
    app: { slug: 'test-app' },
    backend: {
      supabase: {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      },
    },
    design: {
      colors: {
        primary: '#6366F1',
        primaryDark: '#818CF8',
        secondary: '#8B5CF6',
        accent: '#06B6D4',
        background: '#F5F5F7',
        backgroundDark: '#0D0D0F',
        surface: '#FFFFFF',
        surfaceDark: '#111114',
        text: '#111827',
        textDark: '#F9FAFB',
        textSecondary: '#6B7280',
        textSecondaryDark: '#9CA3AF',
        border: '#E5E7EB',
        borderDark: '#1E1E24',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
    },
    features: {
      anonymousAuth: {
        enabled: true,
        tables: ['todos', 'preferences'],
      },
      darkMode: { default: 'system' },
      helpSystem: false,
      showBuiltWithBadge: false,
      inAppPurchases: { enabled: false },
    },
  },
}));

import { signInAnonymously, upgradeAnonymousAccount } from '../../services/auth';
import { ServiceError } from '../../services/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function successfulMigrationFetch() {
  mockFunctionsInvoke.mockResolvedValueOnce({
    data: {
      status: 'completed',
      table_rowcounts: { todos: 3, preferences: 1 },
    },
    error: null,
  });
}

// ─── signInAnonymously ────────────────────────────────────────────────────────

describe('signInAnonymously()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns userId on successful anonymous sign-in', async () => {
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: { id: 'anon-user-id-abc' } },
      error: null,
    });

    const result = await signInAnonymously();
    expect(result).toEqual({ userId: 'anon-user-id-abc' });
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('throws ServiceError with code anon_signin_failed when Supabase returns an error', async () => {
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Anonymous sign-in disabled' },
    });

    await expect(signInAnonymously()).rejects.toMatchObject({
      code: 'anon_signin_failed',
      status: 500,
    });
  });

  it('throws ServiceError when user is null even without an error object', async () => {
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(signInAnonymously()).rejects.toBeInstanceOf(ServiceError);
  });
});

// ─── upgradeAnonymousAccount ──────────────────────────────────────────────────

describe('upgradeAnonymousAccount()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: session with access token
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-access-token' } },
    });
  });

  it('throws ServiceError not_anonymous when current user is NOT anonymous', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'perm-user', is_anonymous: false } },
      error: null,
    });

    await expect(
      upgradeAnonymousAccount({ email: 'test@example.com', password: 'Password123!' }),
    ).rejects.toMatchObject({
      code: 'not_anonymous',
      status: 400,
    });
  });

  it('returns { conflictWith } when email already exists (updateUser conflict)', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'anon-user-id', is_anonymous: true } },
      error: null,
    });
    mockUpdateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'email already exists', code: 'email_exists', status: 422 },
    });

    const result = await upgradeAnonymousAccount({
      email: 'taken@example.com',
      password: 'Password123!',
    });

    expect(result).toMatchObject({ migrated: 0, conflictWith: 'taken@example.com' });
    expect(result.perTableRowcounts).toEqual({});
  });

  it('calls migrate_anonymous_data edge function on success and returns migrated count', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'anon-user-id', is_anonymous: true } },
      error: null,
    });
    mockUpdateUser.mockResolvedValueOnce({
      data: { user: { id: 'perm-user-id' } },
      error: null,
    });
    successfulMigrationFetch();

    const result = await upgradeAnonymousAccount({
      email: 'new@example.com',
      password: 'Password123!',
    });

expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      'migrate_anonymous_data',
      expect.objectContaining({
        body: JSON.stringify({
          anonUserId: 'anon-user-id',
          permanentUserId: 'perm-user-id',
          tables: ['todos', 'preferences'],
        }),
      }),
    );

    expect(result.migrated).toBe(4); // 3 todos + 1 preference
    expect(result.perTableRowcounts).toEqual({ todos: 3, preferences: 1 });
  });

  it('returns { conflictWith } for OAuth when identity already linked', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'anon-user-id', is_anonymous: true } },
      error: null,
    });
    mockLinkIdentity.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Identity already exists', code: 'identity_already_exists' },
    });

    const result = await upgradeAnonymousAccount({
      provider: 'apple',
      idToken: 'apple-id-token',
      nonce: 'random-nonce',
    });

    expect(result).toMatchObject({
      migrated: 0,
      conflictWith: 'apple:linked_to_other_account',
    });
  });

  it('calls linkIdentity for OAuth upgrade and returns migrated rows on success', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'anon-user-id', is_anonymous: true } },
      error: null,
    });
    mockLinkIdentity.mockResolvedValueOnce({
      data: { user: { id: 'perm-user-id' } },
      error: null,
    });
    successfulMigrationFetch();

    const result = await upgradeAnonymousAccount({
      provider: 'google',
      idToken: 'google-id-token',
    });

    expect(mockLinkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    );
    expect(result.migrated).toBe(4);
  });
});