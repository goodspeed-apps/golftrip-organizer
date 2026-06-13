/**
 * GAS Template, Internationalization (i18n)
 *
 * i18next initialization with expo-localization for automatic locale
 * detection. Loads translations from a locales/ directory at the project root.
 *
 * Conditional on gasConfig.features.i18n.enabled, if disabled, falls back
 * to the default locale with no translation loading.
 *
 * Config: gasConfig.features.i18n for enabled flag, locales list, defaultLocale.
 *
 * Expected directory structure:
 *   locales/
 *     en.json    // { "greeting": "Hello", "goodbye": "Goodbye" }
 *     es.json    // { "greeting": "Hola", "goodbye": "Adios" }
 *     fr.json    // { "greeting": "Bonjour", "goodbye": "Au revoir" }
 *
 * Usage:
 *   import { t, changeLanguage, getCurrentLanguage } from '../lib/i18n';
 *   const label = t('greeting'); // "Hello" or translated equivalent
 *
 * Dependencies: i18next, react-i18next, expo-localization
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { gasConfig } from '../gas.config';

const i18nConfig = gasConfig.features.i18n;

// ─── Locale Detection ────────────────────────────────────────────────────────

/**
 * Get the device's preferred language code (e.g., "en", "es", "fr").
 * Falls back to the configured default locale.
 */
function getDeviceLocale(): string {
  try {
    const locales = getLocales();
    const deviceLang = locales[0]?.languageCode ?? i18nConfig.defaultLocale;
    // Only use device locale if it's in our supported list
    if (i18nConfig.locales.includes(deviceLang)) {
      return deviceLang;
    }
    return i18nConfig.defaultLocale;
  } catch {
    return i18nConfig.defaultLocale;
  }
}

// ─── Translation Loading ─────────────────────────────────────────────────────
// Translations are loaded statically via require(). The DevAgent generates
// the locales/ directory and populates the JSON files during code generation.
//
// IMPORTANT: This resources object must be populated by the DevAgent with
// actual require() calls for each locale file. The template provides the
// structure; the generated app fills in the imports.
//
// Example (DevAgent generates this):
//   const resources = {
//     en: { translation: require('../locales/en.json') },
//     es: { translation: require('../locales/es.json') },
//   };

const resources: Record<string, { translation: Record<string, string> }> = {};

// Placeholder: DevAgent replaces this block with actual locale imports.
// For template purposes, we initialize with an empty default locale.
if (Object.keys(resources).length === 0) {
  resources[i18nConfig.defaultLocale] = { translation: {} };
  if (__DEV__ && i18nConfig.enabled) {
    console.warn(
      '[i18n] No translation resources loaded. DevAgent should populate the locales/ directory ' +
      'and add require() calls to this file. All t() calls will return raw keys.',
    );
  }
}

// ─── i18next Initialization ──────────────────────────────────────────────────

i18n.use(initReactI18next).init({
  resources,
  lng: i18nConfig.enabled ? getDeviceLocale() : i18nConfig.defaultLocale,
  fallbackLng: i18nConfig.defaultLocale,
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // Prevent hydration issues in React Native
  },
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Translate a key. Shorthand for i18n.t().
 *
 * @param key - Translation key (e.g., "greeting", "settings.title")
 * @param options - Interpolation variables (e.g., { name: "Alice" })
 */
export function t(key: string, options?: Record<string, unknown>): string {
  return String(i18n.t(key, options as any));
}

/**
 * Change the active language at runtime.
 *
 * @param locale - Language code (must be in gasConfig.features.i18n.locales)
 */
export async function changeLanguage(locale: string): Promise<void> {
  if (i18nConfig.locales.includes(locale)) {
    await i18n.changeLanguage(locale);
  } else if (__DEV__) {
    console.warn(`[i18n] Locale "${locale}" not in supported locales:`, i18nConfig.locales);
  }
}

/**
 * Get the currently active language code.
 */
export function getCurrentLanguage(): string {
  return i18n.language;
}

/**
 * Get the list of supported locales from config.
 */
export function getSupportedLocales(): string[] {
  return [...i18nConfig.locales];
}

export default i18n;
