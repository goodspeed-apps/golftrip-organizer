/**
 * Tests for lib/clipboard.ts
 */

const mockSetString = jest.fn(async () => {});
const mockGetString = jest.fn(async () => 'clipboard-text');
jest.mock('expo-clipboard', () => ({
  setStringAsync: mockSetString,
  getStringAsync: mockGetString,
}));
jest.mock('../../lib/haptics', () => ({ lightTap: jest.fn() }));

import { copyToClipboard, getClipboard, clearClipboard } from '../../lib/clipboard';
import { lightTap } from '../../lib/haptics';

beforeEach(() => jest.clearAllMocks());

describe('copyToClipboard', () => {
  test('copies text and returns true', async () => {
    expect(await copyToClipboard('hello')).toBe(true);
    expect(mockSetString).toHaveBeenCalledWith('hello');
  });

  test('triggers haptic by default', async () => {
    await copyToClipboard('hi');
    expect(lightTap).toHaveBeenCalled();
  });

  test('skips haptic when haptic=false', async () => {
    await copyToClipboard('hi', { haptic: false });
    expect(lightTap).not.toHaveBeenCalled();
  });

  test('returns false on error', async () => {
    mockSetString.mockRejectedValueOnce(new Error('fail'));
    expect(await copyToClipboard('x')).toBe(false);
  });
});

describe('getClipboard', () => {
  test('returns clipboard text', async () => {
    expect(await getClipboard()).toBe('clipboard-text');
  });

  test('returns null on error', async () => {
    mockGetString.mockRejectedValueOnce(new Error('fail'));
    expect(await getClipboard()).toBeNull();
  });
});

describe('clearClipboard', () => {
  test('sets clipboard to empty string', async () => {
    await clearClipboard();
    expect(mockSetString).toHaveBeenCalledWith('');
  });
});
