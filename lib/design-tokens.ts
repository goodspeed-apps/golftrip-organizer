import { gasConfig } from '../gas.config';

export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
const RADIUS_PX: Record<RadiusToken, number> = { none: 0, sm: 6, md: 10, lg: 14, xl: 20, '2xl': 28, full: 999 };
/** Resolve the app's base corner radius (number) from the string enum, with a sane fallback. */
export function radius(token: RadiusToken | string = gasConfig.design.layout.borderRadius): number {
  return RADIUS_PX[token as RadiusToken] ?? RADIUS_PX.lg;
}

/** Like radius(), but capped for large/tall containers (cards, modals) so the `full` token (999) never produces a pill artifact on content-height boxes. */
export function containerRadius(token: RadiusToken | string = gasConfig.design.layout.borderRadius): number {
  return Math.min(radius(token), 28);
}

export type SpacingToken = 'compact' | 'comfortable' | 'spacious';
const SPACING_SCALE: Record<SpacingToken, number> = { compact: 0.8, comfortable: 1, spacious: 1.25 };
/** Multiplier applied to base paddings/gaps so density varies per app. */
export function densityScale(token: SpacingToken | string = gasConfig.design.layout.spacing): number {
  return SPACING_SCALE[token as SpacingToken] ?? 1;
}
/** Pad helper: base px * density, rounded. */
export function pad(basePx: number): number {
  return Math.round(basePx * densityScale());
}

/** Shadow intensity derived from mood so "bold" apps get heavier elevation, "minimal" gets flatter. */
export function cardShadow(mood: string = gasConfig.design.mood) {
  const bold = mood === 'bold' || mood === 'energetic';
  const minimal = mood === 'minimal' || mood === 'calm';
  if (minimal) return { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 };
  if (bold) return { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 6 };
  return { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 };
}
