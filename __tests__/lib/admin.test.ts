/**
 * Tests for lib/admin.ts
 */

const mockFrom = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange },
  },
  getCurrentUserId: async () => {
    const { data } = await mockGetSession();
    return data.session?.user?.id ?? null;
  },
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: mockReplace },
}));

// admin.ts now persists its role decisions via lib/offline.withCache, which
// reads AsyncStorage. Stub it to a pure pass-through so the unit test stays
// focused on the loader behavior + onAuthStateChange invalidation.
jest.mock('../../lib/offline', () => ({
  withCache: async (_key: string, _ttlMs: number, loader: () => Promise<unknown>) => loader(),
  clearCache: jest.fn().mockResolvedValue(undefined),
}));

import { isAdmin, requireAdmin, __clearAdminCache } from '../../lib/admin';

function mockProfile(role: string | null) {
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: role !== null ? { role } : null, error: null }),
      }),
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  __clearAdminCache();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-123' } } } });
});

describe('isAdmin', () => {
  it('returns true when profiles.role is admin', async () => {
    mockProfile('admin');
    const result = await isAdmin('user-123');
    expect(result).toBe(true);
  });

  it('returns false when profiles.role is not admin', async () => {
    mockProfile('user');
    const result = await isAdmin('user-123');
    expect(result).toBe(false);
  });

  it('returns false when profile is null', async () => {
    mockProfile(null);
    const result = await isAdmin('user-123');
    expect(result).toBe(false);
  });

  it('returns false when userId is not provided and session is missing', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await isAdmin();
    expect(result).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('returns true and does not redirect when user is admin', async () => {
    mockProfile('admin');
    const result = await requireAdmin();
    expect(result).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('returns false and redirects to / when user is not admin', async () => {
    mockProfile('user');
    const result = await requireAdmin();
    expect(result).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('redirects when session has no user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await requireAdmin();
    expect(result).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});