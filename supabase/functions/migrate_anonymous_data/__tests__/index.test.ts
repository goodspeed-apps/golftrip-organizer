/**
 * Tests for supabase/functions/migrate_anonymous_data/handler.ts
 *
 * Imports handler.ts (no Deno std URL imports) following the repo pattern
 * established by send_push/__tests__/index.test.ts.
 */

// ─── Deno shim ────────────────────────────────────────────────────────────────
const SERVICE_ROLE_KEY = 'test-service-role-key';
const CRON_SECRET = 'test-cron-secret';

(globalThis as Record<string, unknown>).Deno = {
  env: {
    get: (key: string): string | undefined => {
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return SERVICE_ROLE_KEY;
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return 'test-anon-key';
      if (key === 'CRON_SECRET') return CRON_SECRET;
      return undefined;
    },
  },
};

// ─── Mutable mock state ───────────────────────────────────────────────────────
const mockRpcResult: { data: Record<string, number> | null; error: { message?: string } | null } =
  { data: null, error: null };

const mockInsertResult: { data: { id: string } | null; error: { message?: string } | null } =
  { data: { id: 'migration-id-123' }, error: null };

const mockUpdateCalls: Array<Record<string, unknown>> = [];

// Controls what userClient.auth.getUser() returns
const mockGetUserResult: {
  data: { user: { id: string } | null };
  error: { message?: string } | null;
} = { data: { user: null }, error: { message: 'Unauthorized' } };

// ─── Chainable Supabase mock ──────────────────────────────────────────────────
function makeUpdateChain() {
  const chain = {
    eq: jest.fn().mockResolvedValue({ error: null }),
  };
  return chain;
}

function makeInsertChain() {
  return {
    select: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve(mockInsertResult)),
    })),
  };
}

// Idempotency check chain: .select().eq().eq().eq().maybeSingle() → no existing record by default
function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: jest.fn(),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  chain.eq.mockReturnValue(chain);
  return chain;
}

const mockRpc = jest.fn(() => Promise.resolve(mockRpcResult));

const mockFrom = jest.fn((_table: string) => ({
  select: jest.fn(() => makeSelectChain({ data: null, error: null })),
  insert: jest.fn(() => makeInsertChain()),
  update: jest.fn((vals: Record<string, unknown>) => {
    mockUpdateCalls.push(vals);
    return makeUpdateChain();
  }),
}));

const mockGetUser = jest.fn(() => Promise.resolve(mockGetUserResult));

jest.mock('../../_shared/edge-client', () => ({
  serviceClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
  userClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

jest.mock('../../_shared/edge-response', () => ({
  handleOptions: (req: Request) =>
    req.method === 'OPTIONS' ? new Response('ok') : null,
  json: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  err: (message: string, status = 400, code?: string) =>
    new Response(JSON.stringify({ error: message, code: code ?? null }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

jest.mock('../../_shared/http-error', () => ({
  HttpError: class HttpError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
      this.name = 'HttpError';
    }
  },
}));

jest.mock('../../_shared/edge-logger', () => ({
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

// ─── Import handler under test ────────────────────────────────────────────────
import { handleMigrateAnonymous } from '../handler';

// ─── Test UUIDs ───────────────────────────────────────────────────────────────
const ANON_USER_ID = '00000000-0000-0000-0000-000000000001';
const PERM_USER_ID = '00000000-0000-0000-0000-000000000002';
const ANON_USER_ID_2 = '00000000-0000-0000-0000-000000000003';
const PERM_USER_ID_2 = '00000000-0000-0000-0000-000000000004';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(
  body: unknown,
  authHeader?: string,
  cronHeader?: string,
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;
  if (cronHeader) headers['x-cron-secret'] = cronHeader;
  return new Request('https://test.supabase.co/functions/v1/migrate_anonymous_data', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateCalls.length = 0;
  mockRpcResult.data = { todos: 3, preferences: 1 };
  mockRpcResult.error = null;
  mockInsertResult.data = { id: 'migration-id-123' };
  mockInsertResult.error = null;
  // Default: no authenticated user
  mockGetUserResult.data = { user: null };
  mockGetUserResult.error = { message: 'Unauthorized' };
});

describe('migrate_anonymous_data handler', () => {
  describe('authentication', () => {
    it('rejects requests without Authorization or x-cron-secret header', async () => {
      const req = makeRequest({
        anonUserId: ANON_USER_ID,
        permanentUserId: PERM_USER_ID,
        tables: ['todos'],
      });
      const res = await handleMigrateAnonymous(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('auth_required');
    });

    it('rejects requests with an invalid bearer token (getUser fails)', async () => {
      mockGetUserResult.data = { user: null };
      mockGetUserResult.error = { message: 'invalid token' };

      const req = makeRequest(
        { anonUserId: ANON_USER_ID, permanentUserId: PERM_USER_ID, tables: ['todos'] },
        'Bearer invalid-token',
      );
      const res = await handleMigrateAnonymous(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('auth_invalid');
    });

    it('accepts requests with valid CRON_SECRET header', async () => {
      const req = makeRequest(
        { anonUserId: ANON_USER_ID, permanentUserId: PERM_USER_ID, tables: ['todos'] },
        undefined,
        CRON_SECRET,
      );
      const res = await handleMigrateAnonymous(req);
      expect(res.status).toBe(200);
    });

    it('accepts requests with valid user JWT where callerUserId matches permanentUserId', async () => {
      mockGetUserResult.data = { user: { id: PERM_USER_ID } };
      mockGetUserResult.error = null;

      const req = makeRequest(
        { anonUserId: ANON_USER_ID, permanentUserId: PERM_USER_ID, tables: ['todos'] },
        'Bearer valid-user-jwt',
      );
      const res = await handleMigrateAnonymous(req);
      expect(res.status).toBe(200);
    });

    it('rejects user JWT where callerUserId does not match permanentUserId', async () => {
      mockGetUserResult.data = { user: { id: PERM_USER_ID_2 } };
      mockGetUserResult.error = null;

      const req = makeRequest(
        { anonUserId: ANON_USER_ID, permanentUserId: PERM_USER_ID, tables: ['todos'] },
        'Bearer different-user-jwt',
      );
      const res = await handleMigrateAnonymous(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('user_mismatch');
    });
  });

  describe('successful migration', () => {
    it('calls migrate_anonymous_user_data RPC with correct arguments', async () => {
      mockRpcResult.data = { todos: 5, notes: 2 };
      const req = makeRequest(
        { anonUserId: ANON_USER_ID_2, permanentUserId: PERM_USER_ID_2, tables: ['todos', 'notes'] },
        undefined,
        CRON_SECRET,
      );
      await handleMigrateAnonymous(req);

      expect(mockRpc).toHaveBeenCalledWith('migrate_anonymous_user_data', {
        p_anon_user_id: ANON_USER_ID_2,
        p_permanent_user_id: PERM_USER_ID_2,
        p_tables: ['todos', 'notes'],
      });
    });

    it('writes anonymous_migrations row with status completed on success', async () => {
      mockRpcResult.data = { todos: 3 };
      const req = makeRequest(
        { anonUserId: ANON_USER_ID, permanentUserId: PERM_USER_ID, tables: ['todos'] },
        undefined,
        CRON_SECRET,
      );
      const res = await handleMigrateAnonymous(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('completed');
      expect(body.table_rowcounts).toEqual({ todos: 3 });
      expect(mockUpdateCalls.some(u => u['status'] === 'completed')).toBe(true);
    });
  });

  describe('failed migration', () => {
    it('writes anonymous_migrations row with status failed on RPC error', async () => {
      mockRpcResult.data = null;
      mockRpcResult.error = { message: 'relation "todos" does not exist' };

      const req = makeRequest(
        { anonUserId: ANON_USER_ID, permanentUserId: PERM_USER_ID, tables: ['todos'] },
        undefined,
        CRON_SECRET,
      );
      const res = await handleMigrateAnonymous(req);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe('migration_failed');
      expect(mockUpdateCalls.some(u => u['status'] === 'failed')).toBe(true);
    });
  });
});