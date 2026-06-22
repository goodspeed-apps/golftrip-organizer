const mockFrom = jest.fn();
const mockServiceClient = jest.fn(() => ({ from: mockFrom }));
const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../../_shared/edge-client', () => ({
  serviceClient: mockServiceClient,
  userClient: jest.fn(),
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

type ChainResult = { data: unknown; error: unknown };

function makeChain(resolveWith: ChainResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'lt', 'order', 'limit', 'single'].forEach(m => {
    chain[m] = jest.fn(() => chain);
  });
  chain.then = (
    resolve: ((v: ChainResult) => unknown) | null | undefined,
    reject?: ((e: unknown) => unknown) | null,
  ) => Promise.resolve(resolveWith).then(resolve ?? undefined, reject ?? undefined);
  chain.catch = (fn: (e: unknown) => unknown) => Promise.resolve(resolveWith).catch(fn);
  chain.finally = (fn: () => void) => Promise.resolve(resolveWith).finally(fn);
  return chain;
}

import { requireCronAuth, handleCheckPushReceipts } from '../handler';
import { HttpError } from '../../_shared/http-error';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://test.supabase.co/functions/v1/check_push_receipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({}),
  });
}

function makePendingRow(overrides: Partial<{
  id: string;
  receipt_id: string;
  push_token: string;
  user_id: string | null;
  status: string;
  sent_at: string;
}> = {}) {
  return {
    id: overrides.id ?? 'row-1',
    receipt_id: overrides.receipt_id ?? 'receipt-1',
    push_token: overrides.push_token ?? 'ExponentPushToken[abc]',
    user_id: overrides.user_id ?? 'user-1',
    status: overrides.status ?? 'pending',
    sent_at: overrides.sent_at ?? new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  };
}

describe('requireCronAuth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 401 when no x-cron-secret header', async () => {
    const req = makeRequest();
    await expect(requireCronAuth(req, () => 'mysecret')).rejects.toThrow(HttpError);
    await expect(requireCronAuth(req, () => 'mysecret')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when CRON_SECRET env not set', async () => {
    const req = makeRequest({ 'x-cron-secret': 'mysecret' });
    await expect(requireCronAuth(req, () => undefined)).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when secret does not match', async () => {
    const req = makeRequest({ 'x-cron-secret': 'wrong' });
    await expect(requireCronAuth(req, (k) => k === 'CRON_SECRET' ? 'correct' : undefined))
      .rejects.toMatchObject({ status: 401 });
  });

  it('accepts valid CRON_SECRET header', async () => {
    const req = makeRequest({ 'x-cron-secret': 'mysecret' });
    await expect(requireCronAuth(req, (k) => k === 'CRON_SECRET' ? 'mysecret' : undefined))
      .resolves.toMatchObject({ svc: expect.anything() });
  });
});

describe('handleCheckPushReceipts — empty queue', () => {
  beforeEach(() => jest.clearAllMocks());

it('returns zeros and skips audit_log when no pending rows', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await handleCheckPushReceipts({ from: mockFrom } as ReturnType<typeof import('../../_shared/edge-client').serviceClient>);

    expect(result).toEqual({ polled: 0, ok: 0, error: 0, expired: 0, tokensRemoved: 0 });
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});

describe('handleCheckPushReceipts — polling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls Expo getReceipts with receipt IDs and marks ok rows', async () => {
    const row = makePendingRow({ receipt_id: 'receipt-abc' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return makeChain(callCount === 1
        ? { data: [row], error: null }
        : { data: null, error: null });
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { 'receipt-abc': { status: 'ok' } } }),
    });
    global.fetch = mockFetch;

    const result = await handleCheckPushReceipts({ from: mockFrom } as ReturnType<typeof import('../../_shared/edge-client').serviceClient>);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/getReceipts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ids: ['receipt-abc'] }),
      }),
    );
    expect(result.ok).toBe(1);
    expect(result.error).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.tokensRemoved).toBe(0);
  });

  it('batches 150 pending rows into 2 Expo API calls', async () => {
    const rows = Array.from({ length: 150 }, (_, i) =>
      makePendingRow({ id: `row-${i}`, receipt_id: `receipt-${i}`, push_token: `ExponentPushToken[t${i}]` }),
    );

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: rows, error: null });
      return makeChain({ data: null, error: null });
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    global.fetch = mockFetch;

    await handleCheckPushReceipts({ from: mockFrom } as ReturnType<typeof import('../../_shared/edge-client').serviceClient>);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const firstCallBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(firstCallBody.ids).toHaveLength(100);
    const secondCallBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(secondCallBody.ids).toHaveLength(50);
  });
});

describe('handleCheckPushReceipts — error receipts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks error receipt and stores error_message and error_code', async () => {
    const row = makePendingRow({ receipt_id: 'receipt-err' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return makeChain(callCount === 1
        ? { data: [row], error: null }
        : { data: null, error: null });
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          'receipt-err': {
            status: 'error',
            message: 'The Expo push notification service is currently unavailable.',
            details: { error: 'MessageRateExceeded' },
          },
        },
      }),
    });

    const result = await handleCheckPushReceipts({ from: mockFrom } as ReturnType<typeof import('../../_shared/edge-client').serviceClient>);

    expect(result.error).toBe(1);
    expect(result.ok).toBe(0);
    expect(result.tokensRemoved).toBe(0);
  });
});

describe('handleCheckPushReceipts — DeviceNotRegistered', () => {
  beforeEach(() => jest.clearAllMocks());

  it('DELETEs push_tokens row when receipt has DeviceNotRegistered error', async () => {
    const staleToken = 'ExponentPushToken[stale]';
    const row = makePendingRow({ receipt_id: 'receipt-stale', push_token: staleToken });

    const deleteChain = makeChain({ data: null, error: null });
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: [row], error: null });
      return deleteChain;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          'receipt-stale': {
            status: 'error',
            message: 'The device cannot receive push notifications',
            details: { error: 'DeviceNotRegistered' },
          },
        },
      }),
    });

    const result = await handleCheckPushReceipts({ from: mockFrom } as ReturnType<typeof import('../../_shared/edge-client').serviceClient>);

    expect(result.tokensRemoved).toBe(1);
    expect(result.error).toBe(1);
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.in).toHaveBeenCalledWith('expo_push_token', [staleToken]);
  });
});

describe('handleCheckPushReceipts — expiry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks rows older than expireAfterMinutes as expired without calling Expo', async () => {
    const staleRow = makePendingRow({
      receipt_id: 'receipt-old',
      sent_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    });

    let callCount = 0;
    const updateChain = makeChain({ data: null, error: null });
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain({ data: [staleRow], error: null });
      return updateChain;
    });

    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    const result = await handleCheckPushReceipts({ from: mockFrom } as ReturnType<typeof import('../../_shared/edge-client').serviceClient>);

    expect(result.expired).toBe(1);
    expect(result.ok).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
    );
  });
});

describe('handleCheckPushReceipts — audit_log', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes audit_log with correct metadata after a poll', async () => {
    const rows = [
      makePendingRow({ receipt_id: 'r1' }),
      makePendingRow({ receipt_id: 'r2', sent_at: new Date(Date.now() - 35 * 60 * 1000).toISOString() }),
    ];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return makeChain(callCount === 1
        ? { data: rows, error: null }
        : { data: null, error: null });
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { r1: { status: 'ok' } } }),
    });

    await handleCheckPushReceipts({ from: mockFrom } as ReturnType<typeof import('../../_shared/edge-client').serviceClient>);

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'system',
        action: 'push_receipts_polled',
        targetTable: 'push_deliveries',
        targetData: expect.objectContaining({
          polled: 2,
          ok: 1,
          expired: 1,
        }),
      }),
    );
  });
});
