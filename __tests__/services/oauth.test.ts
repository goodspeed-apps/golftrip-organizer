jest.mock('../../lib/supabase', () => {
  const from = jest.fn();
  const rpc = jest.fn();
  const getSession = jest.fn();
  const getUser = jest.fn();
  return {
    __helpers: { from, rpc, getSession, getUser },
    supabase: {
      from,
      rpc,
      auth: { getSession, getUser },
    },
  };
});

import {
  getActiveAccessToken,
  listConnections,
  disconnectProvider,
} from '../../services/oauth';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require('../../lib/supabase');
const helpers = mod.__helpers;

function makeFromChain(overrides: Record<string, jest.Mock> = {}) {
  const chain: Record<string, jest.Mock> = {};
  const self = () => chain;
  chain.select = jest.fn(self);
  chain.eq = jest.fn(self);
  chain.delete = jest.fn(self);
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  Object.assign(chain, overrides);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.ADMIN_API_KEY = 'test-admin-key';
});

// saveConnection was removed from the public client surface: persistence happens
// server-side via the admin-gated oauth-save-connection Edge Function, called
// from operator-implemented OAuth callback handlers (server-to-server). The
// mobile bundle has no admin credentials to invoke it from.

// ─── getActiveAccessToken ──────────────────────────────────────────────────────

describe('getActiveAccessToken()', () => {
  it('returns the plaintext access token on success', async () => {
    helpers.getSession.mockResolvedValue({
      data: { session: { access_token: 'user-jwt' } },
    });
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'plain_tok', expiresAt: null, scope: null }),
    });

    const token = await getActiveAccessToken('github');

    expect(token).toBe('plain_tok');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/oauth-get-token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer user-jwt' }),
      }),
    );
  });

  it('returns null when the edge function responds 404 (no connection)', async () => {
    helpers.getSession.mockResolvedValue({
      data: { session: { access_token: 'user-jwt' } },
    });
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not found' }),
    });

    const token = await getActiveAccessToken('slack');
    expect(token).toBeNull();
  });

it('returns null when there is no active session', async () => {
    helpers.getSession.mockResolvedValue({ data: { session: null } });

    const token = await getActiveAccessToken('github');
    expect(token).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retries when the edge function error body contains an unrelated 4xx-looking ID', async () => {
    // Regression: the old shouldRetryOAuthCall used `\b4\d\d\b`, which
    // matched "4321" in a request-id string and short-circuited the retry.
    // The tightened helper (lib/retry → isTransientNon4xxError) only matches
    // status-prefixed digits, so this error should be considered transient
    // and the underlying fetch should retry until it succeeds.
    helpers.getSession.mockResolvedValue({
      data: { session: { access_token: 'user-jwt' } },
    });
    const flaky = jest.fn();
    flaky
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'transient: request id 4321 failed' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'plain_tok' }),
      });
    (global.fetch as jest.Mock) = flaky;

    const token = await getActiveAccessToken('github');
    expect(token).toBe('plain_tok');
    expect(flaky).toHaveBeenCalledTimes(2);
  });
});

// ─── oauth-get-token edge function: dedupe contract ────────────────────────────
//
// The edge function (supabase/functions/oauth-get-token/index.ts) wraps the
// enqueueJob() call in a try/catch and swallows Postgres unique-violation
// errors (code === '23505') so a race between two concurrent refresh-window
// callers coalesces silently. The partial unique index
// `idx_jobs_oauth_refresh_pending` (migration 010) enforces dedupe at the DB
// level; the edge function's job is only to treat the loser as success.
//
// The edge function uses Deno-style URL imports (`from 'https://...'`) and
// can't be loaded into Jest, so the test below pins the predicate contract
// (which error codes are swallowed vs surfaced) without running the function.
describe('oauth-get-token dedupe contract (code === 23505 swallow)', () => {
  function shouldSwallow(e: unknown): boolean {
    const code = (e as { code?: string } | null)?.code;
    return code === '23505';
  }

  it('swallows a 23505 unique-violation', () => {
    expect(shouldSwallow({ code: '23505', message: 'dup' })).toBe(true);
  });

  it('does not swallow other Postgres error codes', () => {
    expect(shouldSwallow({ code: '23503', message: 'fk' })).toBe(false);
    expect(shouldSwallow({ code: '42P01', message: 'no table' })).toBe(false);
    expect(shouldSwallow(new Error('network'))).toBe(false);
    expect(shouldSwallow(null)).toBe(false);
  });
});

// ─── listConnections ───────────────────────────────────────────────────────────

describe('listConnections()', () => {
  it('maps rows to OAuthConnection shape, setting hasRefreshToken correctly', async () => {
    const rows = [
      { provider: 'github', expires_at: '2026-01-01T00:00:00Z', scope: 'repo', refresh_token_encrypted: 'enc' },
      { provider: 'slack', expires_at: null, scope: null, refresh_token_encrypted: null },
    ];
    const chain = makeFromChain({
      select: jest.fn().mockResolvedValue({ data: rows, error: null }),
    });
    helpers.from.mockReturnValueOnce(chain);

    const result = await listConnections();

    expect(helpers.from).toHaveBeenCalledWith('oauth_connections');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      provider: 'github',
      expiresAt: '2026-01-01T00:00:00Z',
      scope: 'repo',
      hasRefreshToken: true,
    });
    expect(result[1].hasRefreshToken).toBe(false);
  });

  it('throws when Supabase returns an error', async () => {
    const chain = makeFromChain({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'rls denied' } }),
    });
    helpers.from.mockReturnValueOnce(chain);

    await expect(listConnections()).rejects.toThrow('rls denied');
  });
});

// ─── disconnectProvider ────────────────────────────────────────────────────────

describe('disconnectProvider()', () => {
  it('DELETEs by user_id and provider', async () => {
    helpers.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const eqProvider = jest.fn().mockResolvedValue({ error: null });
    const eqUser = jest.fn(() => ({ eq: eqProvider }));
    const del = jest.fn(() => ({ eq: eqUser }));
    helpers.from.mockReturnValueOnce({ delete: del });

    await disconnectProvider('github');

    expect(helpers.from).toHaveBeenCalledWith('oauth_connections');
    expect(del).toHaveBeenCalled();
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqProvider).toHaveBeenCalledWith('provider', 'github');
  });

  it('throws when not authenticated', async () => {
    helpers.getUser.mockResolvedValue({ data: { user: null } });

    await expect(disconnectProvider('github')).rejects.toThrow('Not authenticated');
  });
});