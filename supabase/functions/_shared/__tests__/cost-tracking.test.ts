// supabase/functions/_shared/__tests__/cost-tracking.test.ts

jest.mock('../edge-client', () => ({
  serviceClient: jest.fn(),
}));

import { consumeCost } from '../cost-tracking';
import { serviceClient } from '../edge-client';

describe('consumeCost', () => {
  const mockRpc = jest.fn();
  beforeEach(() => {
    mockRpc.mockReset();
    (serviceClient as jest.Mock).mockReturnValue({ rpc: mockRpc });
  });

  it('allowed=true when within cap', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, remaining: 9.5, reset_at: '2026-05-13T00:00:00Z', enforcement: 'throttle', throttled: false },
      error: null,
    });
    const r = await consumeCost({ scope: 'llm_chat', key: 'u1', cost: 0.5 });
    expect(r).toEqual({
      allowed: true,
      remaining: 9.5,
      resetAt: '2026-05-13T00:00:00Z',
      enforcement: 'throttle',
      throttled: false,
    });
  });

  it('allowed=false when blocked over cap', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { allowed: false, remaining: 0, reset_at: '2026-05-13T00:00:00Z', enforcement: 'block', throttled: false },
      error: null,
    });
    const r = await consumeCost({ scope: 'llm_chat', key: 'u1', cost: 10 });
    expect(r.allowed).toBe(false);
    expect(r.enforcement).toBe('block');
  });

  it('allowed=true throttled=true when over cap with throttle', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, remaining: 0, reset_at: '2026-05-13T00:00:00Z', enforcement: 'throttle', throttled: true },
      error: null,
    });
    const r = await consumeCost({ scope: 'llm_chat', key: 'u1', cost: 1 });
    expect(r.allowed).toBe(true);
    expect(r.throttled).toBe(true);
  });

  it('allowed=true with alert_only over cap', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, remaining: -2.5, reset_at: '2026-05-13T00:00:00Z', enforcement: 'alert_only', throttled: false },
      error: null,
    });
    const r = await consumeCost({ scope: 'llm_chat', key: 'u1', cost: 5 });
    expect(r.allowed).toBe(true);
    expect(r.enforcement).toBe('alert_only');
  });
});