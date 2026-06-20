/**
 * GAS Template, Deep Linking Utilities
 *
 * Parse and create deep links for in-app navigation.
 */

import { gasConfig } from '../gas.config';

export interface DeepLinkResult {
  screen: string;
  params: Record<string, string>;
}

/** Parse a deep link URL into screen and params. Returns null if invalid. */
export function parseDeepLink(url: string): DeepLinkResult | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    if (pathParts.length === 0) return null;

    const screen = pathParts.join('/');
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => { params[key] = value; });

    return { screen, params };
  } catch {
    return null;
  }
}

/** Create a deep link URL for a screen. */
export function createDeepLink(screen: string, params?: Record<string, string>): string {
  const scheme = gasConfig.app.slug;
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return `${scheme}://${screen}${query}`;
}
