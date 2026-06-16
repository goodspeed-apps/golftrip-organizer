/**
 * GAS Template, Theme Constants
 *
 * Color palette, spacing scale, and border radius values derived from
 * gasConfig.design. Provides light/dark color variants plus layout tokens
 * that adapt to the configured spacing and borderRadius settings.
 *
 * Config: reads from gasConfig.design.colors, gasConfig.design.layout.
 *
 * Usage:
 *   import { Colors, Spacing, BorderRadius } from '../lib/theme';
 *   const bg = Colors.dark.background; // or Colors.light.background
 *   const pad = Spacing.base;          // 16 for 'comfortable'
 */

import { gasConfig } from '../gas.config';

const c = gasConfig.design.colors;

// ─── Colors ──────────────────────────────────────────────────────────────────
// Maps the flat GasColorPalette into light/dark mode objects matching
// the pattern components expect: Colors.dark.background, Colors.light.text, etc.

export const Colors = {
  primary: c.primary,
  primaryDark: c.primaryDark,
  secondary: c.secondary,
  accent: c.accent,
  warning: c.warning,
  error: c.error,
  success: c.success,
  light: {
    background: c.background,
    surface: c.surface,
    surfaceElevated: c.surface,    // Light mode: surface and elevated are the same
    card: c.surface,
    text: c.text,
    textSecondary: c.textSecondary,
    textMuted: c.textSecondary,    // Muted falls back to secondary in light
    border: c.border,
    borderSubtle: c.border,
    statusBar: 'dark' as const,
  },
  dark: {
    background: c.backgroundDark,
    surface: c.surfaceDark,
    surfaceElevated: c.surfaceDark,
    card: c.surfaceDark,
    text: c.textDark,
    textSecondary: c.textSecondaryDark,
    textMuted: c.textSecondaryDark,
    border: c.borderDark,
    borderSubtle: c.borderDark,
    statusBar: 'light' as const,
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
// Three presets: compact (smaller gaps), comfortable (default), spacious (larger).
// Each returns a consistent scale from xs through 3xl.

const SPACING_SCALES = {
  compact: { xs: 2, sm: 4, md: 8, base: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 36 },
  comfortable: { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, '2xl': 32, '3xl': 48 },
  spacious: { xs: 6, sm: 10, md: 16, base: 20, lg: 28, xl: 32, '2xl': 40, '3xl': 56 },
} as const;

export const Spacing = SPACING_SCALES[gasConfig.design.layout.spacing];

// ─── Border Radius ───────────────────────────────────────────────────────────
// Maps the layout.borderRadius config value to a concrete scale.
// 'none' produces all zeros; 'full' uses large pill-like values.

const BORDER_RADIUS_SCALES = {
  none: { sm: 0, md: 0, lg: 0, xl: 0, full: 0 },
  sm:   { sm: 2, md: 4, lg: 6, xl: 8, full: 9999 },
  md:   { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  lg:   { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 },
  xl:   { sm: 8, md: 14, lg: 20, xl: 28, full: 9999 },
  '2xl': { sm: 12, md: 18, lg: 24, xl: 32, full: 9999 },
  full: { sm: 9999, md: 9999, lg: 9999, xl: 9999, full: 9999 },
} as const;

export const BorderRadius = BORDER_RADIUS_SCALES[gasConfig.design.layout.borderRadius];

// ─── Types ───────────────────────────────────────────────────────────────────

export type ColorScheme = 'light' | 'dark' | 'system';
