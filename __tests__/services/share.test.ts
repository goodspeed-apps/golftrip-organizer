const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn(() => ({ insert: mockInsert }));
const mockGetSession = jest.fn();
const mockCaptureEvent = jest.fn();
const mockCaptureException = jest.fn();
const mockShareContent = jest.fn().mockResolvedValue({ success: true });
const mockRandomBase32 = jest.fn().mockResolvedValue('ABCDEFGH');

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
  getCurrentUserId: async () => {
    const { data } = await mockGetSession();
    return data.session?.user?.id ?? null;
  },
}));

jest.mock('../../lib/posthog', () => ({
  captureEvent: (...args: unknown[]) => mockCaptureEvent(...args),
}));

jest.mock('../../lib/sentry', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('../../lib/sharing', () => ({
  shareContent: (...args: unknown[]) => mockShareContent(...args),
}));

jest.mock('../../lib/crypto', () => ({
  randomBase32: (...args: unknown[]) => mockRandomBase32(...args),
}));

jest.mock('../../gas.config', () => ({
  gasConfig: {
    growth: { referralCodeLength: 8, experimentsEnabled: true, defaultBackgroundSyncInterval: 60_000 },
    multiTenancy: { enabled: false, defaultRole: 'member' },
  },
}));

import { generateReferralCode, share } from '../../services/share';

beforeEach(() => {
  jest.clearAllMocks();
  mockShareContent.mockResolvedValue({ success: true });
  mockRandomBase32.mockResolvedValue('ABCDEFGH');
});

describe('generateReferralCode', () => {
  test('inserts a referral row and returns the code', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    const code = await generateReferralCode();
    expect(mockFrom).toHaveBeenCalledWith('referrals');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ referrer_user_id: 'user-1' }));
    expect(typeof code).toBe('string');
    expect(code.length).toBe(8);
  });

  test('passes referralCodeLength to randomBase32', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-2' } } } });
    await generateReferralCode();
    expect(mockRandomBase32).toHaveBeenCalledWith(8);
  });

  test('throws ServiceError when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(generateReferralCode()).rejects.toMatchObject({ code: 'share.401', status: 401 });
  });

  test('captures exception and throws ServiceError on db failure', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockInsert.mockResolvedValueOnce({ error: { message: 'unique violation' } });
    await expect(generateReferralCode()).rejects.toMatchObject({ code: 'share.db', status: 500 });
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'unique violation' }),
      expect.objectContaining({ service: 'share' }),
    );
  });
});

describe('share', () => {
  test('delegates to shareContent with referral code in message', async () => {
    const result = await share({ code: 'ABCD1234', subject: 'Join!', message: 'Check this out', url: 'https://example.com' });
    expect(mockShareContent).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Join!',
      message: expect.stringContaining('ABCD1234'),
      url: 'https://example.com',
    }));
    expect(result.shared).toBe(true);
  });

  test('returns shared:false when shareContent fails', async () => {
    mockShareContent.mockResolvedValueOnce({ success: false });
    const result = await share({ code: 'XYZ', subject: 'Hi', message: 'Msg' });
    expect(result.shared).toBe(false);
  });

  test('passes url through to shareContent', async () => {
    await share({ code: 'CODE', subject: 'S', message: 'M', url: 'https://app.com' });
    expect(mockShareContent).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://app.com',
    }));
  });

  test('emits EVENTS.share_completed only when shared', async () => {
    await share({ code: 'CODE', subject: 'S', message: 'M' });
    expect(mockCaptureEvent).toHaveBeenCalledWith('share_completed', { code: 'CODE' });

    mockCaptureEvent.mockClear();
    mockShareContent.mockResolvedValueOnce({ success: false });
    await share({ code: 'CODE2', subject: 'S', message: 'M' });
    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });
});
