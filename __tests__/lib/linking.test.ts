/**
 * Tests for lib/linking.ts
 */

const mockCanOpen = jest.fn(async () => true);
const mockOpen = jest.fn(async () => {});
const mockSettings = jest.fn(async () => {});
jest.mock('expo-linking', () => ({
  canOpenURL: mockCanOpen,
  openURL: mockOpen,
  openSettings: mockSettings,
}));
jest.mock('../../lib/sentry', () => ({ captureException: jest.fn() }));

import { openURL, openAppSettings, openMailClient, openPhone, canOpenURL, isSafeUrl } from '../../lib/linking';

beforeEach(() => jest.clearAllMocks());

describe('isSafeUrl (deep-link allowlist)', () => {
  test.each(['https://x.com', 'http://x.com', 'mailto:a@b.com', 'tel:+15551234567', 'sms:+15551234567'])(
    'allows safe scheme: %s',
    (url) => expect(isSafeUrl(url)).toBe(true),
  );
  test.each(['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,<script>', 'content://x', 'ftp://x', '/relative/path', 'no-scheme'])(
    'blocks unsafe/relative: %s',
    (url) => expect(isSafeUrl(url)).toBe(false),
  );
  test('openURL refuses a javascript: URL without calling Linking.openURL', async () => {
    expect(await openURL('javascript:alert(1)')).toBe(false);
    expect(mockOpen).not.toHaveBeenCalled();
  });
});

describe('openURL', () => {
  test('opens valid URL and returns true', async () => {
    expect(await openURL('https://example.com')).toBe(true);
    expect(mockOpen).toHaveBeenCalledWith('https://example.com');
  });

  test('returns false if URL not supported', async () => {
    mockCanOpen.mockResolvedValueOnce(false);
    expect(await openURL('invalid://url')).toBe(false);
    expect(mockOpen).not.toHaveBeenCalled();
  });

  test('returns false on error', async () => {
    mockOpen.mockRejectedValueOnce(new Error('fail'));
    expect(await openURL('https://x.com')).toBe(false);
  });
});

describe('openAppSettings', () => {
  test('calls Linking.openSettings', async () => {
    await openAppSettings();
    expect(mockSettings).toHaveBeenCalled();
  });
});

describe('openMailClient', () => {
  test('constructs mailto URL with options', async () => {
    await openMailClient({ to: 'a@b.com', subject: 'Hi', body: 'Hello' });
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('mailto:a@b.com'));
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('subject=Hi'));
  });

  test('handles no options', async () => {
    await openMailClient();
    expect(mockOpen).toHaveBeenCalledWith('mailto:');
  });
});

describe('openPhone', () => {
  test('constructs tel URL', async () => {
    await openPhone('1234567890');
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('tel:1234567890'));
  });
});

describe('canOpenURL', () => {
  test('returns true for supported URL', async () => {
    expect(await canOpenURL('https://x.com')).toBe(true);
  });

  test('returns false on error', async () => {
    mockCanOpen.mockRejectedValueOnce(new Error('fail'));
    expect(await canOpenURL('bad')).toBe(false);
  });
});
