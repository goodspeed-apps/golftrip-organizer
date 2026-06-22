// __tests__/services/async-backbone.test.ts
// Verifies the new helpers in services/api.ts call the right backends.

jest.mock('../../lib/supabase', () => {
  const insert = jest.fn();
  const single = jest.fn();
  const select = jest.fn(() => ({ single }));
  insert.mockReturnValue({ select });
  const from = jest.fn(() => ({ insert }));
  const invoke = jest.fn();
  return {
    __helpers: { from, invoke, insert, select, single },
    supabase: {
      from,
      functions: { invoke },
    },
  };
});

jest.mock('../../lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('../../lib/sentry', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock('../../lib/performance', () => ({ trackApiLatency: jest.fn() }));
jest.mock('../../lib/offline', () => ({
  cacheQuery: jest.fn(),
  getCached: jest.fn(() => null),
  clearCache: jest.fn(),
  queueMutation: jest.fn(),
  flushQueue: jest.fn(),
}));
jest.mock('../../lib/retry', () => ({
  retryWithBackoff: jest.fn((fn: () => unknown) => fn()),
}));

import { enqueueJob, sendEmail, sendPush } from '../../services/api';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMod = require('../../lib/supabase');
const helpers = supabaseMod.__helpers;

describe('async backbone helpers', () => {
  beforeEach(() => {
    helpers.from.mockClear();
    helpers.insert.mockClear();
    helpers.select.mockClear();
    helpers.single.mockClear();
    helpers.invoke.mockClear();
  });

  it('enqueueJob inserts into jobs table', async () => {
    helpers.single.mockResolvedValueOnce({ data: { id: 'job-1' }, error: null });
    const out = await enqueueJob({ kind: 'send_email', payload: { x: 1 } });
    expect(out).toEqual({ id: 'job-1' });
    expect(helpers.from).toHaveBeenCalledWith('jobs');
    expect(helpers.insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'send_email',
      payload: { x: 1 },
      max_attempts: 5,
    }));
  });

  it('sendEmail invokes send-email function', async () => {
    helpers.invoke.mockResolvedValueOnce({ data: { id: 'log-1', status: 'sent' }, error: null });
    const out = await sendEmail({ template: 'welcome', to: 'a@b.com', vars: { appName: 'X', displayName: 'Y' } });
    expect(out).toEqual({ id: 'log-1', status: 'sent' });
    expect(helpers.invoke).toHaveBeenCalledWith('send-email', expect.anything());
  });

  it('sendPush invokes send-push function', async () => {
    helpers.invoke.mockResolvedValueOnce({ data: { sent: 2 }, error: null });
    const out = await sendPush({ userId: 'u1', title: 'hi' });
    expect(out).toEqual({ sent: 2 });
    expect(helpers.invoke).toHaveBeenCalledWith('send-push', expect.anything());
  });
});