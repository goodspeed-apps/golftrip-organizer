/**
 * Tests for lib/sharing.ts
 */

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock('expo-file-system', () => ({
  // expo-file-system v17+ replaced the flat `cacheDirectory` constant with a
  // `Paths.cache.uri` accessor (lib/sharing.ts:185 uses the new shape).
  cacheDirectory: '/tmp/',
  Paths: { cache: { uri: '/tmp/' } },
  writeAsStringAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));
jest.mock('react-native', () => ({
  Share: {
    share: jest.fn(async () => ({ action: 'sharedAction' })),
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
  },
  Platform: { OS: 'ios' },
}));
jest.mock('../../lib/sentry', () => ({ captureException: jest.fn() }));

import { shareContent, isSharingAvailable, shareFile, shareTextAsFile } from '../../lib/sharing';
import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

beforeEach(() => jest.clearAllMocks());

describe('shareContent', () => {
  test('returns success on shared action', async () => {
    const result = await shareContent({ message: 'Hello!' });
    expect(result.success).toBe(true);
  });

  test('returns failure on dismissed action', async () => {
    (Share.share as jest.Mock).mockResolvedValueOnce({ action: 'dismissedAction' });
    const result = await shareContent({ message: 'Hello!' });
    expect(result.success).toBe(false);
  });

  test('returns error on exception', async () => {
    (Share.share as jest.Mock).mockRejectedValueOnce(new Error('Share failed'));
    const result = await shareContent({ message: 'Hello!' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Share failed');
  });
});

describe('isSharingAvailable', () => {
  test('returns true when available', async () => {
    expect(await isSharingAvailable()).toBe(true);
  });
});

describe('shareFile', () => {
  test('shares file successfully', async () => {
    const result = await shareFile('file://test.pdf', { mimeType: 'application/pdf' });
    expect(result.success).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });

  test('returns error when sharing unavailable', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    const result = await shareFile('file://test.pdf');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });
});

describe('shareTextAsFile', () => {
  test('writes temp file, shares, and cleans up', async () => {
    const result = await shareTextAsFile('csv data', 'export.csv', 'text/csv');
    expect(result.success).toBe(true);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  test('cleans up even on error', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('write fail'));
    const result = await shareTextAsFile('data', 'test.txt');
    expect(result.success).toBe(false);
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });
});
