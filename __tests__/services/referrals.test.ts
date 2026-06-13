const mockGetSession = jest.fn();
const mockUpdate = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockIs = jest.fn().mockReturnThis();
const mockSelectFinal = jest.fn().mockResolvedValue({ data: [{ id: 'r-1', code: 'CODE123' }], error: null });
const mockSelect = jest.fn().mockReturnThis();
const mockEqSelect = jest.fn().mockReturnThis();
const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });
const mockFrom = jest.fn();
const mockCaptureEvent = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
  getCurrentUserId: async () => {
    const res = await mockGetSession();
    return res?.data?.session?.user?.id ?? null;
  },
}));

jest.mock('../../lib/posthog', () => ({
  captureEvent: (...args: unknown[]) => mockCaptureEvent(...args),
}));

jest.mock('../../lib/sentry', () => ({
  captureException: jest.fn(),
}));

import { recordAttribution, listMyReferrals } from '../../services/referrals';
import { EVENTS } from '../../lib/events';

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({
    update: mockUpdate,
    select: mockSelect,
  });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ is: mockIs });
  mockIs.mockReturnValue({ select: mockSelectFinal });
  mockSelectFinal.mockResolvedValue({ data: [{ id: 'r-1', code: 'CODE123' }], error: null });
  mockSelect.mockReturnValue({ eq: mockEqSelect });
  mockEqSelect.mockReturnValue({ order: mockOrder });
});

describe('recordAttribution', () => {
  test('calls update with referred_user_id, event, and attributed_at', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-ref' } } } });
    const result = await recordAttribution('CODE123', 'signup');
    expect(mockFrom).toHaveBeenCalledWith('referrals');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      referred_user_id: 'user-ref',
      attribution_event: 'signup',
    }));
    expect(mockEq).toHaveBeenCalledWith('code', 'CODE123');
    expect(mockIs).toHaveBeenCalledWith('referred_user_id', null);
    expect(result).toBe(true);
  });

  test('returns false without calling update when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await recordAttribution('CODE', 'event');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  test('includes attributed_at as ISO string', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await recordAttribution('ABC', 'purchase');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      attributed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }));
  });

  test('emits referral_attributed event on success', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await recordAttribution('XYZ', 'signup');
    expect(mockCaptureEvent).toHaveBeenCalledWith(EVENTS.referral_attributed, expect.objectContaining({
      code: 'XYZ',
      event: 'signup',
    }));
  });

  test('returns false and skips event when no row matched (race loser)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockSelectFinal.mockResolvedValueOnce({ data: [], error: null });
    const result = await recordAttribution('TAKEN', 'signup');
    expect(result).toBe(false);
    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });
});

describe('listMyReferrals', () => {
  test('returns rows for authenticated user', async () => {
    const rows = [{ code: 'X1', referred_user_id: null, attribution_event: null, attributed_at: null }];
    mockOrder.mockResolvedValueOnce({ data: rows, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    const result = await listMyReferrals();
    expect(result).toEqual(rows);
    expect(mockEqSelect).toHaveBeenCalledWith('referrer_user_id', 'user-1');
  });

  test('returns empty array when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await listMyReferrals();
    expect(result).toEqual([]);
  });

  test('throws when supabase returns an error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u2' } } } });
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error('db error') });
    await expect(listMyReferrals()).rejects.toThrow('db error');
  });
});