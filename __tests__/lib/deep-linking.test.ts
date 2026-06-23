/**
 * Tests for lib/deep-linking.ts — Deep link parsing and creation.
 */

import { parseDeepLink, createDeepLink } from '../../lib/deep-linking';
import { gasConfig } from '../../gas.config';

describe('parseDeepLink', () => {
  test('parses valid deep link', () => {
    const result = parseDeepLink(`https://app.example.com/profile/settings?tab=privacy`);
    expect(result).toEqual({
      screen: 'profile/settings',
      params: { tab: 'privacy' },
    });
  });

  test('parses link without params', () => {
    const result = parseDeepLink(`https://app.example.com/dashboard`);
    expect(result).toEqual({ screen: 'dashboard', params: {} });
  });

  test('returns null for invalid URL', () => {
    expect(parseDeepLink('not a url')).toBeNull();
  });

  test('returns null for empty path', () => {
    expect(parseDeepLink(`https://app.example.com/`)).toBeNull();
  });
});

describe('createDeepLink', () => {
  test('creates link with params', () => {
    const link = createDeepLink('profile', { id: '123' });
    expect(link).toBe(`${gasConfig.app.slug}://profile?id=123`);
  });

  test('creates link without params', () => {
    const link = createDeepLink('home');
    expect(link).toBe(`${gasConfig.app.slug}://home`);
  });
});
