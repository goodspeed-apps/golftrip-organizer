// __tests__/services/cluster2-compliance.test.ts

jest.mock('../../lib/supabase', () => {
  const invoke = jest.fn();
  const from = jest.fn();
  return {
    __helpers: { invoke, from },
    supabase: {
      from,
      functions: { invoke },
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
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

import { requestDataExport, requestAccountDeletion, cancelAccountDeletion } from '../../services/api';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMod = require('../../lib/supabase');
const helpers = supabaseMod.__helpers;

describe('cluster 2 compliance helpers', () => {
  beforeEach(() => {
    helpers.invoke.mockReset();
  });

  it('requestDataExport invokes request-data-export', async () => {
    helpers.invoke.mockResolvedValueOnce({ data: { requestId: 'r1', status: 'pending' }, error: null });
    const out = await requestDataExport();
    expect(out).toEqual({ requestId: 'r1', status: 'pending' });
    expect(helpers.invoke).toHaveBeenCalledWith('request-data-export', expect.anything());
  });

  it('requestAccountDeletion forwards immediate flag', async () => {
    helpers.invoke.mockResolvedValueOnce({ data: { scheduled_for: '2026-06-01T00:00:00Z', immediate: true }, error: null });
    const out = await requestAccountDeletion({ immediate: true, reason: 'test' });
    expect(out.immediate).toBe(true);
    expect(helpers.invoke).toHaveBeenCalledWith('request-account-deletion', expect.anything());
  });

  it('cancelAccountDeletion returns cancelled', async () => {
    helpers.invoke.mockResolvedValueOnce({ data: { cancelled: true }, error: null });
    const out = await cancelAccountDeletion();
    expect(out.cancelled).toBe(true);
    expect(helpers.invoke).toHaveBeenCalledWith('cancel-account-deletion', expect.anything());
  });
});