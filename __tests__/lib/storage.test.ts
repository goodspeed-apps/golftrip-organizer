/**
 * Tests for lib/storage.ts — App-scoped AsyncStorage wrapper.
 */

import { getStorageKey, getItem, setItem, removeItem } from '../../lib/storage';
import { gasConfig } from '../../gas.config';

// Mock dependencies
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn() }));

beforeEach(() => { mockStore.clear(); });

describe('getStorageKey', () => {
  test('prefixes with app slug', () => {
    const key = getStorageKey('theme');
    expect(key).toBe(`@${gasConfig.app.slug}:theme`);
  });
});

describe('getItem', () => {
  test('returns parsed JSON value', async () => {
    mockStore.set(`@${gasConfig.app.slug}:test`, JSON.stringify({ foo: 'bar' }));
    const result = await getItem<{ foo: string }>('test');
    expect(result).toEqual({ foo: 'bar' });
  });

  test('returns null for missing key', async () => {
    const result = await getItem('nonexistent');
    expect(result).toBeNull();
  });

  test('returns null for corrupted JSON', async () => {
    mockStore.set(`@${gasConfig.app.slug}:bad`, '{invalid json');
    const result = await getItem('bad');
    expect(result).toBeNull();
  });
});

describe('setItem', () => {
  test('stores JSON-serialized value', async () => {
    await setItem('myKey', { count: 42 });
    const raw = mockStore.get(`@${gasConfig.app.slug}:myKey`);
    expect(JSON.parse(raw!)).toEqual({ count: 42 });
  });
});

describe('removeItem', () => {
  test('removes the key', async () => {
    mockStore.set(`@${gasConfig.app.slug}:toRemove`, '"val"');
    await removeItem('toRemove');
    expect(mockStore.has(`@${gasConfig.app.slug}:toRemove`)).toBe(false);
  });
});
