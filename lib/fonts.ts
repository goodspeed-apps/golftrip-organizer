import { gasConfig } from '../gas.config';

/**
 * camelCase font name -> Google/TTF family name (spaced).
 * "SpaceGrotesk" -> "Space Grotesk", "IBMPlexSans" -> "IBM Plex Sans", "Inter" -> "Inter".
 * This must match the worker's slug logic so the registered family name equals
 * the font's internal family name (what iOS resolves at render time).
 */
export function fontFamilyName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

/**
 * The app's display font family (spaced slug), or undefined for the 'system'
 * sentinel (so callers omit fontFamily and the OS default renders).
 */
export function displayFamily(): string | undefined {
  const f = gasConfig.design.typography.displayFont;
  return f && f !== 'system' && f !== 'monospace' ? fontFamilyName(f) : undefined;
}

export function bodyFamily(): string | undefined {
  const f = gasConfig.design.typography.bodyFont;
  return f && f !== 'system' && f !== 'monospace' ? fontFamilyName(f) : undefined;
}

/**
 * The app's monospace font family, or 'monospace' for the platform default.
 * Always returns a usable value (never undefined) since monospace is always appropriate.
 */
export function monoFamily(): string {
  const f = gasConfig.design.typography.monoFont;
  return f && f !== 'system' ? fontFamilyName(f) : 'monospace';
}
