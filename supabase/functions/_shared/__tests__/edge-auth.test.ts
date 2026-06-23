// supabase/functions/_shared/__tests__/edge-auth.test.ts
// Tests for requireAdminJwt.

// Mock Deno global (not available in Jest/Node)
(globalThis as Record<string, unknown>).Deno = {
  env: { get: (_k: string) => undefined },
};

// Mock edge-client before importing edge-auth
jest.mock('../edge-client', () => ({
  userClient: jest.fn(),
  serviceClient: jest.fn(),
}));

// Mock edge-response to avoid Deno.env usage in corsOriginHeader
jest.mock('../edge-response', () => ({
  err: jest.fn((message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), { status })
  ),
}));

import { requireAdminJwt } from '../edge-auth';
import { userClient, serviceClient } from '../edge-client';

function makeReq(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) headers['authorization'] = authHeader;
  return new Request('https://example.com/grant-credits', {
    method: 'POST',
    headers,
  });
}

describe('requireAdminJwt', () => {
  const mockGetUser = jest.fn();
  const mockSingle = jest.fn();
  const mockEq = jest.fn();
  const mockSelect = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();

    (userClient as jest.Mock).mockReturnValue({
      auth: { getUser: mockGetUser },
    });

    mockSingle.mockResolvedValue({ data: null, error: null });
    mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    (serviceClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ select: mockSelect }),
    });
  });

  it('returns 401 when no Authorization header is present', async () => {
    const req = makeReq();
    const result = await requireAdminJwt(req);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(401);
  });

  it('returns 401 when Authorization header is not a Bearer token', async () => {
    const req = makeReq('Basic dXNlcjpwYXNz');
    const result = await requireAdminJwt(req);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(401);
  });

  it('returns 401 when JWT is invalid (getUser returns error)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid jwt') });
    const req = makeReq('Bearer bad.jwt.token');
    const result = await requireAdminJwt(req);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(401);
  });

  it('returns 403 when user exists but role is not admin', async () => {
    const fakeUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
    mockSingle.mockResolvedValue({ data: { role: 'user' }, error: null });

    const req = makeReq('Bearer valid.jwt.token');
    const result = await requireAdminJwt(req);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(403);
  });

  it('returns 403 when profile row is missing', async () => {
    const fakeUser = { id: 'user-123' };
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });

    const req = makeReq('Bearer valid.jwt.token');
    const result = await requireAdminJwt(req);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(403);
  });

it('returns { user } when Bearer JWT belongs to an admin', async () => {
    const fakeUser = { id: 'admin-456', email: 'admin@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
    mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });

    const req = makeReq('Bearer valid.admin.jwt');
    const result = await requireAdminJwt(req);
    expect(result instanceof Response).toBe(false);
    expect((result as { user: unknown }).user).toEqual(fakeUser);

    // Pin: profiles.role must be read via service_role to bypass RLS.
    // If a future refactor swaps in the user client, RLS will silently block
    // the role lookup and this assertion catches it.
    expect(serviceClient).toHaveBeenCalled();
    const svcInstance = (serviceClient as jest.Mock).mock.results[0].value;
    expect(svcInstance.from).toHaveBeenCalledWith('profiles');
    // Confirm userClient was NOT used for the profiles query
    const userInstance = (userClient as jest.Mock).mock.results[0].value;
    expect(userInstance.from).toBeUndefined();
  });
});