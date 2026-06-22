/**
 * GAS Template, Clipboard Utilities
 *
 * Copy/paste with optional haptic feedback and toast.
 */

import * as Clipboard from 'expo-clipboard';
import { lightTap } from './haptics';

export interface CopyOptions {
  haptic?: boolean;
}

/** Copy text to clipboard. Returns true on success. */
export async function copyToClipboard(text: string, options?: CopyOptions): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    if (options?.haptic !== false) lightTap();
    return true;
  } catch {
    return false;
  }
}

/** Get current clipboard text. Returns null on failure. */
export async function getClipboard(): Promise<string | null> {
  try {
    return await Clipboard.getStringAsync();
  } catch {
    return null;
  }
}

/** Clear the clipboard. */
export async function clearClipboard(): Promise<void> {
  try {
    await Clipboard.setStringAsync('');
  } catch {
    // Non-critical
  }
}
