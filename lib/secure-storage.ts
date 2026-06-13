/**
 * GAS Template, Secure Storage
 *
 * Wrapper around expo-secure-store for sensitive data (tokens, keys).
 * On web, falls back to localStorage since SecureStore is not available.
 */

import { isWeb } from './platform';
import { addBreadcrumb } from './sentry';

// Conditionally import SecureStore only on native
let SecureStore: typeof import('expo-secure-store') | null = null;
if (!isWeb) {
  SecureStore = require('expo-secure-store');
}

/** Get a value from secure storage. */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (isWeb) return localStorage.getItem(key);
    return await SecureStore?.getItemAsync(key) ?? null;
  } catch {
    addBreadcrumb('secure-storage', `Failed to read: ${key}`);
    return null;
  }
}

/** Set a value in secure storage. */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (isWeb) { localStorage.setItem(key, value); return; }
    await SecureStore?.setItemAsync(key, value);
  } catch {
    addBreadcrumb('secure-storage', `Failed to write: ${key}`);
  }
}

/** Delete a value from secure storage. */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (isWeb) { localStorage.removeItem(key); return; }
    await SecureStore?.deleteItemAsync(key);
  } catch {
    addBreadcrumb('secure-storage', `Failed to delete: ${key}`);
  }
}
