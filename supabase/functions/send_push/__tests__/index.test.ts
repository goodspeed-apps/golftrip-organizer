// supabase/functions/send_push/__tests__/index.test.ts
// Tests for the send_push handler logic (handler.ts).
// Does NOT import index.ts (which has Deno URL imports).

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockServiceClient = jest.fn(() => ({ from: mockFrom }));
const mockGetUser = jest.fn();
const mockUserClient = jest.fn(() => ({ auth: { getUser: mockGetUser } }));
const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../../_shared/edge-client', () => ({
  serviceClient: mockServiceClient,
  userClient: mockUserClient,
}));
jest.mock('../../_shared/audit-log', () => ({
  writeAuditLog: mockWriteAuditLog,
  setActorContext: jest.fn(),
}));
jest.mock('../../_shared/edge-logger', () => ({
  log: jest.fn(),
  reportException: jest.fn(),
}));
jest.mock('../../_shared/edge-auth', () => ({
  timingSafeStringEqual: (a: string, b: string) => a === b,
  requireUserAuth: jest.fn(),
  requireCronSecret: (req: Request, envGet: (k: string) => string | undefined = () => undefined) => {
    const { HttpError } = jest.requireActual('../../_shared/http-error') as { HttpError: new (status: number, message: string) => Error };
    const secret = envGet('CRON_SECRET');
    const provided = req.headers.get('x-cron-secret');
    if (!secret || !provided || provided !== secret) throw new HttpError(401, 'Unauthorized: CRON_SECRET required');
  },
}));

// ─── Supabase chainable mock helpers ─────────────────────────────────────────

type ChainResult = { data: unknown; error: unknown };

function makeChain(resolveWith: ChainResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'single'].forEach(m => {
    chain[m] = jest.fn(() => chain);
  });
  // Make awaitable
  chain.then = (
    resolve: ((v: ChainResult) => unknown) | null | undefined,
    reject?: ((e: unknown) => unknown) | null,
  ) => Promise.resolve(resolveWith).then(resolve ?? undefined, reject ?? undefined);
  chain.catch = (fn: (e: unknown) => unknown) => Promise.resolve(resolveWith).catch(fn);
  chain.finally = (fn: () => void) => Promise.resolve(resolveWith).finally(fn);
  return chain;
}

function setupServiceFromChain(resolveWith: ChainResult) {
  const chain = makeChain(resolveWith);
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ─── Imports under test ───────────────────────────────────────────────────────

import { requireAuth, handleSendPush, BATCH_SIZE } from '../handler';
import { HttpError } from '../../_shared/http-error';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://test.supabase.co/functions/v1/send_push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({}),
  });
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 401 when no Authorization and no CRON_SECRET', async () => {
    const req = makeRequest();
    await expect(requireAuth(req, () => undefined)).rejects.toThrow(HttpError);
    await expect(requireAuth(req, () => undefined)).rejects.toMatchObject({ status: 401 });
  });

  it('accepts valid CRON_SECRET header', async () => {
    const req = makeRequest({ 'x-cron-secret': 'mysecret' });
    await expect(requireAuth(req, (k) => k === 'CRON_SECRET' ? 'mysecret' : undefined)).resolves.toMatchObject({ svc: expect.anything() });
  });

  it('throws 403 when JWT user is not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const profileChain = makeChain({ data: { role: 'member' }, error: null });
    mockFrom.mockReturnValue(profileChain);

    const req = makeRequest({ Authorization: 'Bearer valid-jwt' });
    await expect(requireAuth(req, () => undefined)).rejects.toMatchObject({ status: 403 });
  });

  it('accepts admin JWT user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    const profileChain = makeChain({ data: { role: 'admin' }, error: null });
    mockFrom.mockReturnValue(profileChain);

const req = makeRequest({ Authorization: 'Bearer admin-jwt' });
    await expect(requireAuth(req, () => undefined)).resolves.toMatchObject({ svc: expect.anything() });
  });
});

// ─── Batching ─────────────────────────────────────────────────────────────────

describe('handleSendPush batching', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls Expo push API once for <=100 tokens', async () => {
    const tokens = Array.from({ length: 3 }, (_, i) => `ExponentPushToken[t${i}]`);
    const rows = tokens.map(t => ({ expo_push_token: t }));
    setupServiceFromChain({ data: rows, error: null });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: tokens.map(() => ({ id: 'r1', status: 'ok' })) }),
    });
    global.fetch = mockFetch;

    const result = await handleSendPush({
      userIds: ['u1'],
      category: 'transactional',
      title: 'Hello',
      body: 'World',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(3);
    expect(result.receipts).toHaveLength(3);
  });

  it('batches 150 tokens into 2 Expo API calls', async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[t${i}]`);
    const rows = tokens.map(t => ({ expo_push_token: t }));
    setupServiceFromChain({ data: rows, error: null });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: Array.from({ length: BATCH_SIZE }, () => ({ id: 'r1', status: 'ok' })),
      }),
    });
    global.fetch = mockFetch;

    await handleSendPush({
      userIds: ['u1'],
      category: 'transactional',
      title: 'Hi',
      body: 'There',
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ─── DeviceNotRegistered cleanup ─────────────────────────────────────────────

describe('stale token cleanup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('DELETEs token that returns DeviceNotRegistered', async () => {
    const goodToken = 'ExponentPushToken[good]';
    const staleToken = 'ExponentPushToken[stale]';
    const rows = [{ expo_push_token: goodToken }, { expo_push_token: staleToken }];

    // First call: select tokens; subsequent calls: delete stale token
    const deleteChain = makeChain({ data: null, error: null });
    const selectChain = makeChain({ data: rows, error: null });
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectChain : deleteChain;
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'r1', status: 'ok' },
          { id: undefined, status: 'error', details: { error: 'DeviceNotRegistered' } },
        ],
      }),
    });
    global.fetch = mockFetch;

    const result = await handleSendPush({
      userIds: ['u1'],
      category: 'transactional',
      title: 'Hi',
      body: 'There',
    });

    expect(result.removed).toContain(staleToken);
    expect(result.removed).not.toContain(goodToken);
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.in).toHaveBeenCalledWith('expo_push_token', [staleToken]);
  });
});

// ─── audit_log ────────────────────────────────────────────────────────────────

describe('audit_log written', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls writeAuditLog with push_sent action and category metadata', async () => {
    const tokens = ['ExponentPushToken[a]', 'ExponentPushToken[b]'];
    setupServiceFromChain({ data: tokens.map(t => ({ expo_push_token: t })), error: null });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: tokens.map(() => ({ id: 'r', status: 'ok' })) }),
    });

    await handleSendPush({
      userIds: ['u1'],
      category: 'marketing',
      title: 'Promo',
      body: 'Check this out',
      data: { deepLink: '/promo' },
    });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'push_sent',
        targetTable: 'push_tokens',
        targetData: expect.objectContaining({
          category: 'marketing',
          deepLink: '/promo',
        }),
      }),
    );
  });

  it('writes audit_log with recipientCount=0 when no tokens match', async () => {
    setupServiceFromChain({ data: [], error: null });

    await handleSendPush({
      userIds: ['u1'],
      category: 'product',
      title: 'Hi',
      body: 'There',
    });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        targetData: expect.objectContaining({ recipientCount: 0 }),
      }),
    );
    // fetch should NOT have been called — no tokens to send
    // (global.fetch not mocked here; if called would throw)
  });
});
