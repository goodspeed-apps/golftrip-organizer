/**
 * Tests for lib/secure-storage.ts
 */

const mockGet = jest.fn(async () => 'secret-value');
const mockSet = jest.fn(async () => {});
const mockDelete = jest.fn(async () => {});
jest.mock('expo-secure-store', () => ({
  getItemAsync: mockGet,
  setItemAsync: mockSet,
  deleteItemAsync: mockDelete,
}));
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn() }));

import { getSecureItem, setSecureItem, deleteSecureItem } from '../../lib/secure-storage';
import { addBreadcrumb } from '../../lib/sentry';

beforeEach(() => jest.clearAllMocks());

describe('getSecureItem', () => {
  test('returns stored value', async () => {
    expect(await getSecureItem('token')).toBe('secret-value');
    expect(mockGet).toHaveBeenCalledWith('token');
  });

  test('returns null on error', async () => {
    mockGet.mockRejectedValueOnce(new Error('fail'));
    expect(await getSecureItem('bad')).toBeNull();
    expect(addBreadcrumb).toHaveBeenCalled();
  });
});

describe('setSecureItem', () => {
  test('stores value', async () => {
    await setSecureItem('key', 'val');
    expect(mockSet).toHaveBeenCalledWith('key', 'val');
  });

  test('logs breadcrumb on error', async () => {
    mockSet.mockRejectedValueOnce(new Error('fail'));
    await setSecureItem('key', 'val');
    expect(addBreadcrumb).toHaveBeenCalled();
  });
});

describe('deleteSecureItem', () => {
  test('deletes key', async () => {
    await deleteSecureItem('key');
    expect(mockDelete).toHaveBeenCalledWith('key');
  });

  test('logs breadcrumb on error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('fail'));
    await deleteSecureItem('key');
    expect(addBreadcrumb).toHaveBeenCalled();
  });
});
