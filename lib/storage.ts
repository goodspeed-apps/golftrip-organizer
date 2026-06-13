/**
 * GAS Template, App-Scoped Storage
 *
 * AsyncStorage wrapper with app-scoped keys and JSON serialization.
 * All keys are prefixed with `@{slug}:` to avoid cross-app collisions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addBreadcrumb } from './sentry';
import { gasConfig } from '../gas.config';

/** Build an app-scoped storage key. */
export function getStorageKey(name: string): string {
  return `@${gasConfig.app.slug}:${name}`;
}

/** Read a JSON-serialized value from storage. */
export async function getItem<T>(name: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(name));
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    addBreadcrumb('storage', `Failed to read: ${name}`);
    return null;
  }
}

/** Write a JSON-serialized value to storage. */
export async function setItem<T>(name: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(getStorageKey(name), JSON.stringify(value));
  } catch {
    addBreadcrumb('storage', `Failed to write: ${name}`);
  }
}

/** Remove a key from storage. */
export async function removeItem(name: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getStorageKey(name));
  } catch {
    addBreadcrumb('storage', `Failed to remove: ${name}`);
  }
}
