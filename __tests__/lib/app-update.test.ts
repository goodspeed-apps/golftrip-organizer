/**
 * Tests for lib/app-update.ts
 */

const mockCheck = jest.fn(async () => ({ isAvailable: false } as { isAvailable: boolean; manifest?: Record<string, unknown> }));
const mockFetch = jest.fn(async () => {});
const mockReload = jest.fn(async () => {});
jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: mockCheck,
  fetchUpdateAsync: mockFetch,
  reloadAsync: mockReload,
}));
jest.mock('../../lib/sentry', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }));

import { checkForUpdate, fetchUpdate, applyUpdate } from '../../lib/app-update';

beforeEach(() => jest.clearAllMocks());

describe('checkForUpdate', () => {
  test('returns available=false when no update', async () => {
    const result = await checkForUpdate();
    expect(result.available).toBe(false);
  });

  test('returns available=true when update exists', async () => {
    mockCheck.mockResolvedValueOnce({ isAvailable: true, manifest: { id: '123' } });
    const result = await checkForUpdate();
    expect(result.available).toBe(true);
    expect(result.manifest).toEqual({ id: '123' });
  });

  test('returns available=false on error', async () => {
    mockCheck.mockRejectedValueOnce(new Error('network'));
    const result = await checkForUpdate();
    expect(result.available).toBe(false);
  });
});

describe('fetchUpdate', () => {
  test('returns true on success', async () => {
    expect(await fetchUpdate()).toBe(true);
  });

  test('returns false on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));
    expect(await fetchUpdate()).toBe(false);
  });
});

describe('applyUpdate', () => {
  test('calls reloadAsync', async () => {
    await applyUpdate();
    expect(mockReload).toHaveBeenCalled();
  });
});
