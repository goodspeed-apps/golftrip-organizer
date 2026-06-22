/**
 * Tests for lib/i18n.ts
 */

const mockI18n = {
  use: jest.fn().mockReturnThis(),
  init: jest.fn().mockReturnThis(),
  t: jest.fn((key: string, opts?: any) => {
    if (opts?.name) return `Hello ${opts.name}`;
    return key;
  }),
  changeLanguage: jest.fn(async () => {}),
  language: 'en',
};
jest.mock('i18next', () => ({ __esModule: true, default: mockI18n }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', regionCode: 'US' }]),
}));

// Pin gas.config to the template i18n values these tests assert against, so the
// suite passes even when a generated app customizes gasConfig (e.g. i18n.enabled:false,
// locales:['en-US']). Only the fields lib/i18n.ts actually reads are provided.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    features: { i18n: { enabled: true, locales: ['en', 'es'], defaultLocale: 'en' } },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

(global as any).__DEV__ = true;

import { t, changeLanguage, getCurrentLanguage, getSupportedLocales } from '../../lib/i18n';

beforeEach(() => jest.clearAllMocks());

describe('t', () => {
  test('returns translation key by default', () => {
    expect(t('greeting')).toBe('greeting');
  });

  test('supports interpolation', () => {
    expect(t('hello', { name: 'Alice' })).toBe('Hello Alice');
  });
});

describe('changeLanguage', () => {
  test('changes language when locale is supported', async () => {
    await changeLanguage('en');
    expect(mockI18n.changeLanguage).toHaveBeenCalledWith('en');
  });

  test('does not change language for unsupported locale', async () => {
    await changeLanguage('xx');
    expect(mockI18n.changeLanguage).not.toHaveBeenCalled();
  });
});

describe('getCurrentLanguage', () => {
  test('returns current language', () => {
    expect(getCurrentLanguage()).toBe('en');
  });
});

describe('getSupportedLocales', () => {
  test('returns array of supported locales', () => {
    const locales = getSupportedLocales();
    expect(Array.isArray(locales)).toBe(true);
    expect(locales).toContain('en');
  });
});
