/**
 * GAS Template, URL & Linking Utilities
 *
 * Open URLs, app settings, mail client, phone, with validation.
 */

import * as Linking from 'expo-linking';
import { captureException } from './sentry';

/** Open a URL in the default browser. Returns false on failure. */
export async function openURL(url: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch (err) {
    captureException(err, { component: 'linking', action: 'openURL', url });
    return false;
  }
}

/** Open the OS app settings page (for re-enabling permissions). */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Not supported on all platforms
  }
}

export interface MailOptions {
  to?: string;
  subject?: string;
  body?: string;
}

/** Open the default mail client with pre-filled fields. */
export async function openMailClient(options?: MailOptions): Promise<boolean> {
  const params = new URLSearchParams();
  if (options?.subject) params.set('subject', options.subject);
  if (options?.body) params.set('body', options.body);
  const query = params.toString();
  const mailto = `mailto:${options?.to ?? ''}${query ? `?${query}` : ''}`;
  return openURL(mailto);
}

/** Open the phone dialer with a number. */
export async function openPhone(number: string): Promise<boolean> {
  return openURL(`tel:${number}`);
}

/** Check if a URL can be opened. */
export async function canOpenURL(url: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}
