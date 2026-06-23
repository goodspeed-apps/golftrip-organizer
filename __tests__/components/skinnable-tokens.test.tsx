/**
 * Skinnable design tokens — per-app variation test.
 *
 * Asserts that radius(), pad(), and cardShadow() read from gasConfig so a
 * non-default config produces different resolved values than the template
 * default. Uses the same jest.mock('../../gas.config', ...) pattern as the
 * rest of the components test suite (see Paywall.test.tsx, EmptyState.resolveIcon.test.ts).
 */

// --- mock gas.config BEFORE importing the resolvers ---
// Default template: borderRadius='lg' (14px), spacing='comfortable' (×1), mood='professional'
// Non-default under test: borderRadius='sm' (6px), spacing='compact' (×0.8), mood='bold'
jest.mock('../../gas.config', () => {
  const gasConfig = {
    design: {
      mood: 'bold',
      colors: {
        primary: '#6366F1',
        error: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
      },
      layout: {
        borderRadius: 'sm',
        spacing: 'compact',
        cardStyle: 'elevated',
        buttonStyle: 'rounded',
      },
    },
  };
  return { __esModule: true, gasConfig, default: gasConfig };
});

import { radius, containerRadius, pad, densityScale, cardShadow } from '../../lib/design-tokens';

describe('design-token resolvers read from gasConfig (per-app variation)', () => {
  it('radius() returns the pixel value for the mocked token (sm=6), not the template default (lg=14)', () => {
    // With borderRadius:'sm' mocked, radius() must return 6, not 14.
    expect(radius()).toBe(6);
  });

  it('pad() scales by the mocked density (compact=0.8)', () => {
    // compact density = 0.8 → pad(16) = Math.round(16 * 0.8) = 13
    expect(densityScale()).toBe(0.8);
    expect(pad(16)).toBe(13);
  });

  it('cardShadow() uses the mocked mood (bold) to return heavier elevation', () => {
    // bold mood → elevation 6 (vs professional=3, minimal=1)
    const shadow = cardShadow();
    expect(shadow.elevation).toBe(6);
    expect(shadow.shadowOpacity).toBe(0.16);
  });

  it('containerRadius("full") is capped at 28 — never produces a pill on a tall container', () => {
    // radius('full') = 999; containerRadius caps at 28
    expect(radius('full')).toBe(999);
    expect(containerRadius('full')).toBe(28);
  });

  it('containerRadius() with a normal token passes through unchanged', () => {
    // 'lg' = 14, well below the 28 cap
    expect(containerRadius('lg')).toBe(14);
    // '2xl' = 28, exactly at the cap
    expect(containerRadius('2xl')).toBe(28);
  });
});
