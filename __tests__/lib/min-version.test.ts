/**
 * Tests for lib/min-version.ts
 */

// --- Mocks ---

const mockInvoke = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '2.1.0',
}));

jest.mock('../../lib/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

// Must import after mocks
import { checkMinVersion } from '../../lib/min-version';

describe('checkMinVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('success path: returns mustUpdate=true when server says so', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: false, mustUpdate: true, message: 'Please update', recommendedVersion: '3.0.0' },
      error: null,
    });

    const result = await checkMinVersion();

    expect(mockInvoke).toHaveBeenCalledWith('check-min-version', {
      body: expect.objectContaining({ platform: expect.any(String), clientVersion: '2.1.0' }),
    });
    expect(result.mustUpdate).toBe(true);
    expect(result.message).toBe('Please update');
    expect(result.recommendedVersion).toBe('3.0.0');
  });

  test('success path: returns mustUpdate=false when server says ok', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, mustUpdate: false },
      error: null,
    });

    const result = await checkMinVersion();

    expect(result.mustUpdate).toBe(false);
  });

  test('error path: returns mustUpdate=false when invoke returns an error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Network error'),
    });

    const result = await checkMinVersion();

    expect(result.mustUpdate).toBe(false);
  });

  test('error path: returns mustUpdate=false when invoke throws', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Unexpected failure'));

    const result = await checkMinVersion();

    expect(result.mustUpdate).toBe(false);
  });
});