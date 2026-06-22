/**
 * GAS Template, URL & Linking Utilities
 *
 * Open URLs, app settings, mail client, phone, with validation.
 */

import * as Linking from 'expo-linking';
import { captureException } from './sentry';
import { gasConfig } from '../gas.config';

/**
 * Scheme allowlist for outbound links. A URL whose scheme is not here is refused,
 * so a hostile deep link or a value that flowed in from user/remote content can't
 * trigger `javascript:`, `file:`, `data:`, `content:`, or an arbitrary app scheme.
 */
const SAFE_SCHEMES = new Set<string>(
  ['https', 'http', 'mailto', 'tel', 'sms', gasConfig.app.scheme]
    .filter((s): s is string => Boolean(s))
    .map((s) => `${s.toLowerCase()}:`),
);

/** True only for a URL whose scheme is on the allowlist. */
export function isSafeUrl(url: string): boolean {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url.trim());
  if (!m) return false; // no scheme, never open a bare/relative string
  return SAFE_SCHEMES.has(`${m[1].toLowerCase()}:`);
}

/** Open a URL in the default browser. Returns false on failure or an unsafe scheme. */
export async function openURL(url: string): Promise<boolean> {
  if (!isSafeUrl(url)) {
    captureException(new Error('blocked unsafe URL scheme'), { component: 'linking', action: 'openURL', url });
    return false;
  }
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
