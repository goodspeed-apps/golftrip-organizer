// supabase/functions/_shared/__tests__/rate-limit.test.ts
// Jest test for the consumeRate helper. Mocks the Supabase client.

jest.mock('../edge-client', () => ({
  serviceClient: jest.fn(),
}));

import { consumeRate } from '../rate-limit';
import { serviceClient } from '../edge-client';

describe('consumeRate', () => {
  const mockRpc = jest.fn();
  beforeEach(() => {
    mockRpc.mockReset();
    (serviceClient as jest.Mock).mockReturnValue({ rpc: mockRpc });
  });

  it('returns true when allowed', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(consumeRate({
      scope: 's', key: 'k', capacity: 10, refillPerSecond: 1,
    })).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('consume_rate_limit', expect.objectContaining({
      p_scope: 's', p_key: 'k', p_capacity: 10, p_refill_per_second: 1, p_cost: 1,
    }));
  });

  it('returns false when rate limited', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(consumeRate({
      scope: 's', key: 'k', capacity: 1, refillPerSecond: 0.1,
    })).resolves.toBe(false);
  });

  it('throws when RPC returns error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    await expect(consumeRate({
      scope: 's', key: 'k', capacity: 1, refillPerSecond: 1,
    })).rejects.toThrow('boom');
  });
});