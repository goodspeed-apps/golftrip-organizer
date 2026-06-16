import { orgFilter, useCurrentOrg } from '../../lib/multitenancy';
import { gasConfig } from '../../gas.config';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('react-native-url-polyfill/auto', () => {});
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('../../gas.config', () => ({
  gasConfig: {
    multiTenancy: { enabled: false, defaultRole: 'member' },
    growth: { referralCodeLength: 8, experimentsEnabled: true, defaultBackgroundSyncInterval: 60_000 },
  },
}));

describe('orgFilter', () => {
  test('passes query through when multiTenancy is disabled', () => {
    (gasConfig.multiTenancy as any).enabled = false;
    const mockQuery = { eq: jest.fn().mockReturnThis() };
    const result = orgFilter(mockQuery, 'org-123');
    expect(result).toBe(mockQuery);
    expect(mockQuery.eq).not.toHaveBeenCalled();
  });

  test('applies eq filter when multiTenancy is enabled and orgId set', () => {
    (gasConfig.multiTenancy as any).enabled = true;
    const mockQuery = { eq: jest.fn().mockReturnThis() };
    const result = orgFilter(mockQuery, 'org-abc');
    expect(mockQuery.eq).toHaveBeenCalledWith('organization_id', 'org-abc');
    expect(result).toBe(mockQuery);
    (gasConfig.multiTenancy as any).enabled = false;
  });

  test('passes query through when orgId is null even if enabled', () => {
    (gasConfig.multiTenancy as any).enabled = true;
    const mockQuery = { eq: jest.fn().mockReturnThis() };
    const result = orgFilter(mockQuery, null);
    expect(result).toBe(mockQuery);
    expect(mockQuery.eq).not.toHaveBeenCalled();
    (gasConfig.multiTenancy as any).enabled = false;
  });
});

describe('useCurrentOrg', () => {
  test('module exports useCurrentOrg as a function', () => {
    expect(typeof useCurrentOrg).toBe('function');
  });

  test('orgFilter pass-through with null org returns original query', () => {
    (gasConfig.multiTenancy as any).enabled = true;
    const q = { eq: jest.fn().mockReturnThis() };
    const result = orgFilter(q, null);
    expect(result).toBe(q);
    expect(q.eq).not.toHaveBeenCalled();
    (gasConfig.multiTenancy as any).enabled = false;
  });

  test('orgFilter with empty string orgId passes through when enabled', () => {
    (gasConfig.multiTenancy as any).enabled = true;
    const q = { eq: jest.fn().mockReturnThis() };
    const result = orgFilter(q, '');
    expect(result).toBe(q);
    (gasConfig.multiTenancy as any).enabled = false;
  });
});