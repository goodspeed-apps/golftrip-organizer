/**
 * GAS Template, ThemeContext
 *
 * Provides resolved theme colors to the entire app via React Context.
 *
 * Features:
 * - Wraps useTheme hook to provide theme state to the entire component tree
 * - Derives color values from gasConfig.design.colors based on resolved scheme
 * - Exposes both light and dark color sets via a single `colors` object
 * - Provides `resolved` scheme, `preference`, and `setTheme` for theme switching
 *
 * The color resolution pattern:
 * - Light mode: uses the base color names (primary, background, surface, text, etc.)
 * - Dark mode: uses the *Dark variants (backgroundDark, surfaceDark, textDark, etc.)
 * - Semantic colors (success, warning, error) are shared across both schemes
 *
 * Extracted from ThreadLift, made generic and config-driven.
 *
 * Dependencies: hooks/useTheme, gas.config
 */

import { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { ColorScheme } from '@/hooks/useTheme';
import { useDynamicType } from '@/hooks/useDynamicType';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { captureEvent } from '@/lib/posthog';
import { gasConfig } from '../gas.config';

// --- Derive resolved color objects from gasConfig ---

const configColors = gasConfig.design.colors;

/**
 * Light mode colors, uses base color properties from gasConfig.
 */
const LightColors = {
  primary: configColors.primary,
  secondary: configColors.secondary,
  accent: configColors.accent,
  background: configColors.background,
  surface: configColors.surface,
  text: configColors.text,
  textSecondary: configColors.textSecondary,
  border: configColors.border,
  success: configColors.success,
  warning: configColors.warning,
  error: configColors.error,
  // Aliases for tokens generated screens reliably reference. Mapped to the base
  // palette so app code resolves without hallucinated-token gaps (muted = ~13%
  // alpha tint for subtle backgrounds). Keep LightColors/DarkColors keys in sync.
  textMuted: configColors.textSecondary,
  textFaint: configColors.textSecondary,
  textOnPrimary: '#FFFFFF',
  buttonText: '#FFFFFF',
  surfaceText: configColors.text,
  surfaceElevated: configColors.surface,
  surfaceSecondary: configColors.surface,
  surfaceDark: configColors.surface,
  card: configColors.surface,
  borderAccent: configColors.accent,
  borderDark: configColors.border,
  shadow: configColors.border,
  tertiary: configColors.accent,
  primaryMuted: configColors.primary + '22',
  secondaryMuted: configColors.secondary + '22',
  tertiaryMuted: configColors.accent + '22',
warningMuted: configColors.warning + '22',
  positive: configColors.success,
  negative: configColors.error,
  positiveMuted: configColors.success + '22',
  negativeMuted: configColors.error + '22',
  divider: configColors.border,
  info: configColors.accent,
  infoMuted: configColors.accent + '22',
link: configColors.primary,
  disabled: configColors.textSecondary,
  placeholder: configColors.textSecondary,
  overlay: '#00000088',
  successMuted: configColors.success + '22',
  errorMuted: configColors.error + '22',
  accentMuted: configColors.accent + '22',
  warningBackground: configColors.warning + '22',
  tertiaryBorder: configColors.border,
} as const;

/**
 * Dark mode colors, uses *Dark variants from gasConfig where available.
 * Semantic colors (success, warning, error) are shared with light mode.
 */
const DarkColors = {
  primary: configColors.primaryDark,
  secondary: configColors.secondary,
  accent: configColors.accent,
  background: configColors.backgroundDark,
  surface: configColors.surfaceDark,
  text: configColors.textDark,
  textSecondary: configColors.textSecondaryDark,
  border: configColors.borderDark,
  success: configColors.success,
  warning: configColors.warning,
  error: configColors.error,
  // Aliases, must mirror LightColors keys so `ThemeColors` stays a usable union.
  textMuted: configColors.textSecondaryDark,
  textFaint: configColors.textSecondaryDark,
  textOnPrimary: '#FFFFFF',
  buttonText: '#FFFFFF',
  surfaceText: configColors.textDark,
  surfaceElevated: configColors.surfaceDark,
  surfaceSecondary: configColors.surfaceDark,
  surfaceDark: configColors.surfaceDark,
  card: configColors.surfaceDark,
  borderAccent: configColors.accent,
  borderDark: configColors.borderDark,
  shadow: configColors.borderDark,
  tertiary: configColors.accent,
  primaryMuted: configColors.primaryDark + '22',
  secondaryMuted: configColors.secondary + '22',
  tertiaryMuted: configColors.accent + '22',
warningMuted: configColors.warning + '22',
  positive: configColors.success,
  negative: configColors.error,
  positiveMuted: configColors.success + '22',
  negativeMuted: configColors.error + '22',
  divider: configColors.borderDark,
  info: configColors.accent,
  infoMuted: configColors.accent + '22',
link: configColors.primaryDark,
  disabled: configColors.textSecondaryDark,
  placeholder: configColors.textSecondaryDark,
  overlay: '#00000088',
  successMuted: configColors.success + '22',
  errorMuted: configColors.error + '22',
  accentMuted: configColors.accent + '22',
  warningBackground: configColors.warning + '22',
  tertiaryBorder: configColors.borderDark,
} as const;

export type ThemeColors = typeof LightColors | typeof DarkColors;

type ThemeContextValue = {
  /** Resolved effective scheme: 'light' or 'dark' */
  resolved: 'light' | 'dark';
  /** Raw user preference: 'light', 'dark', or 'system' */
  preference: ColorScheme;
  /** Update and persist theme preference */
  setTheme: (scheme: ColorScheme) => Promise<void>;
  /** Resolved color palette for current scheme */
  colors: ThemeColors;
  /** User's preferred font scale (1.0 default, up to ~3.0 for a11y) */
  fontScale: number;
  /** Whether the user has enabled reduce-motion */
  reducedMotion: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  resolved: 'dark',
  preference: 'system',
  setTheme: async () => {},
  colors: DarkColors,
  fontScale: 1,
  reducedMotion: false,
});

/**
 * ThemeProvider, Wrap your app's root layout with this provider.
 *
 * Usage in app/_layout.tsx:
 *   import { ThemeProvider } from '@/context/ThemeContext';
 *
 *   export default function RootLayout() {
 *     return (
 *       <ThemeProvider>
 *         <Stack />
 *       </ThemeProvider>
 *     );
 *   }
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preference, resolved, setTheme: setThemeRaw } = useTheme();
  const colors = useMemo(() => resolved === 'light' ? LightColors : DarkColors, [resolved]);
  const fontScale = useDynamicType();
  const reducedMotion = useReducedMotion();

  const setTheme = useCallback(async (scheme: ColorScheme) => {
    await setThemeRaw(scheme);
    captureEvent('theme_changed', { theme: scheme });
  }, [setThemeRaw]);

  return (
    <ThemeContext.Provider value={{ resolved, preference, setTheme, colors, fontScale, reducedMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useThemeColors, Access theme context from any component.
 *
 * @returns ThemeContextValue with colors, resolved scheme, preference, and setTheme
 *
 * Usage:
 *   const { colors, resolved, setTheme } = useThemeColors();
 *   <View style={{ backgroundColor: colors.background }}>
 *     <Text style={{ color: colors.text }}>Hello</Text>
 *   </View>
 */
export function useThemeColors() {
  const ctx = useContext(ThemeContext);
  // Support BOTH access patterns generated screens use interchangeably:
  //   const { colors } = useThemeColors(); colors.primary   (destructured)
  //   const colors = useThemeColors();     colors.primary   (direct)
  // Spread the resolved palette onto the returned object (so direct access
  // works) AND keep `.colors` pointing at the palette (so destructuring works).
  // Palette keys never collide with context keys (resolved/preference/etc.).
  return { ...ctx.colors, ...ctx, colors: ctx.colors };
}
