/**
 * GAS Template — MFA Module Tests
 */

// Mock dependencies
jest.mock('../../lib/platform', () => ({ isWeb: false }));
jest.mock('../../lib/sentry', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  sanitizeData: jest.fn((data: any) => data),
}));

const mockMFA = {
  enroll: jest.fn(),
  challenge: jest.fn(),
  verify: jest.fn(),
  unenroll: jest.fn(),
  listFactors: jest.fn(),
  getAuthenticatorAssuranceLevel: jest.fn(),
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { mfa: mockMFA },
  },
}));

// MFA enabled
jest.mock('../../gas.config', () => ({
  gasConfig: {
    app: { slug: 'test-app' },
    features: {
      auth: { mfa: true },
    },
  },
}));

import { enrollMFA, verifyMFA, unenrollMFA, listMFAFactors, getAAL } from '../../lib/mfa';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('enrollMFA', () => {
  test('calls supabase.auth.mfa.enroll and returns data', async () => {
    mockMFA.enroll.mockResolvedValue({
      data: { id: 'factor-1', totp: { uri: 'otpauth://...', secret: 'ABC123' } },
      error: null,
    });

    const result = await enrollMFA();
    expect(result).toEqual({ id: 'factor-1', uri: 'otpauth://...', secret: 'ABC123' });
    expect(mockMFA.enroll).toHaveBeenCalledWith({ factorType: 'totp' });
  });

  test('throws on error', async () => {
    mockMFA.enroll.mockResolvedValue({
      data: null,
      error: new Error('enroll failed'),
    });

    await expect(enrollMFA()).rejects.toThrow('enroll failed');
  });
});

describe('verifyMFA', () => {
  test('challenges and verifies', async () => {
    mockMFA.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null });
    mockMFA.verify.mockResolvedValue({ error: null });

    const result = await verifyMFA('factor-1', '123456');
    expect(result).toBe(true);
    expect(mockMFA.challenge).toHaveBeenCalledWith({ factorId: 'factor-1' });
    expect(mockMFA.verify).toHaveBeenCalledWith({
      factorId: 'factor-1',
      challengeId: 'challenge-1',
      code: '123456',
    });
  });

  test('returns false on verify error', async () => {
    mockMFA.challenge.mockResolvedValue({ data: { id: 'c-1' }, error: null });
    mockMFA.verify.mockResolvedValue({ error: new Error('invalid code') });

    const result = await verifyMFA('factor-1', '000000');
    expect(result).toBe(false);
  });
});

describe('unenrollMFA', () => {
  test('calls unenroll', async () => {
    mockMFA.unenroll.mockResolvedValue({ error: null });

    const result = await unenrollMFA('factor-1');
    expect(result).toBe(true);
    expect(mockMFA.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
  });
});

describe('listMFAFactors', () => {
  test('returns totp factors', async () => {
    mockMFA.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'f-1' }] },
      error: null,
    });

    const result = await listMFAFactors();
    expect(result).toEqual([{ id: 'f-1' }]);
  });
});

describe('getAAL', () => {
  test('returns AAL data', async () => {
    mockMFA.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
      error: null,
    });

    const result = await getAAL();
    expect(result).toEqual({ currentLevel: 'aal1', nextLevel: 'aal2' });
  });
});
