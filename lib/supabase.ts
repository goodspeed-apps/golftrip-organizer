/**
 * GAS Template, Supabase Client
 *
 * Initializes the Supabase client with PKCE auth flow. Token persistence is
 * platform-split: native uses expo-secure-store (device keychain/keystore),
 * web uses localStorage. expo-secure-store is native-only and its eager
 * session-load path crashes the `expo export --platform web` static prerender,
 * so web must never route auth storage through it.
 *
 * Config: reads supabase URL and anon key from gasConfig.backend.supabase.
 * The deep link scheme (for OAuth redirects) comes from gasConfig.app.scheme.
 *
 * Dependencies: @supabase/supabase-js, expo-secure-store, react-native-url-polyfill
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { gasConfig } from '../gas.config';

// --- Native secure storage adapter for Supabase auth tokens ---
// Uses expo-secure-store to persist tokens in the device keychain/keystore.
// Each method is guarded: expo-secure-store can reject (locked keychain,
// values over its 2048-byte limit, or an unavailable keychain on some
// simulators). An unhandled rejection here propagates into supabase-js
// getSession(), which runs before every query, breaking otherwise-public
// reads. Degrade gracefully instead: no persisted session is acceptable;
// a broken data layer is not.
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* secure storage unavailable: session will not persist this launch */
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* nothing to remove / storage unavailable */
    }
  },
};

// --- Web storage adapter ---
// expo-secure-store is native-only, so web auth persistence uses localStorage.
// Guarded on `window`: `expo export --platform web` runs a static prerender in
// Node where `window` is undefined. Returning null there (instead of throwing)
// lets the bundle build and the page mount cleanly.
const WebStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    Promise.resolve(typeof window !== 'undefined' ? window.localStorage.getItem(key) : null),
  setItem: (key: string, value: string): Promise<void> => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    return Promise.resolve();
  },
};

// `expo export --platform web` (static prerender) and unconfigured previews run
// with no EXPO_PUBLIC_SUPABASE_* env, so these resolve empty. createClient throws
// "supabaseUrl is required" on an empty URL, crashing the web export and leaving
// the web preview blank fleet-wide. Fall back to a syntactically valid placeholder
// so the bundle builds and pages mount; the client is inert until real config is
// present (correct for an unconfigured preview/export).
const supabaseUrl = gasConfig.backend.supabase.url || 'https://placeholder.supabase.co';
const supabaseAnonKey = gasConfig.backend.supabase.anonKey || 'public-anon-key-placeholder';

/**
 * The Supabase client instance.
 *
 * Auth is configured with:
 * - PKCE flow (required for mobile apps; no client secret exposed)
 * - Platform-split token persistence (SecureStore native / localStorage web)
 * - Auto-refresh enabled
 * - URL session detection disabled (handled by deep link callback instead)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? WebStorageAdapter : ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// --- Sentry breadcrumb on auth state changes ---
import { addBreadcrumb } from './sentry';

supabase.auth.onAuthStateChange((event: string) => {
  addBreadcrumb('auth', `Supabase auth: ${event}`);
});

/**
 * Resolve the currently authenticated user id, or null if anonymous.
 * Shared helper so we don't repeat the `supabase.auth.getSession()` +
 * `data.session?.user?.id` ceremony across services/hooks.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
