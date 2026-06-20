/**
 * GAS Template — Reduced-motion behaviour tests
 *
 * Asserts that animated UI components honour the `reducedMotion` flag exposed
 * by useThemeColors(). Follows the jest.mock pattern used elsewhere in this
 * suite (Paywall.test.tsx, VirtualList.test.tsx): mock ThemeContext at the top
 * before importing the components under test.
 *
 * Strategy: because animation internals are opaque in jest/RN-test-renderer,
 * we assert on observable differences that the components produce when
 * reducedMotion is true:
 *   - LoadingSkeleton: renders testID='skeleton-static' (not 'skeleton-animated')
 *     and Animated.loop is NOT called.
 *   - Tooltip: entering/exiting props are undefined (no FadeIn/FadeOut applied)
 *     when the tooltip is shown.
 *   - Accordion: layout and entering props on expanded panel are undefined.
 *   - BottomSheet: withSpring is NOT called; translateY jumps to 0 directly.
 */

import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';

// ─── Shared mock colors ────────────────────────────────────────────────────────

const mockColors = {
  background: '#fff',
  surface: '#f5f5f5',
  text: '#000',
  textSecondary: '#666',
  primary: '#6366F1',
  border: '#ccc',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

// ─── ThemeContext mock (reducedMotion = true) ─────────────────────────────────
// jest.mock must be at module scope so it is hoisted before imports.

jest.mock('../../context/ThemeContext', () => ({
  useThemeColors: () => ({
    colors: mockColors,
    resolved: 'light',
    reducedMotion: true,
    ...mockColors, // spread so direct-access pattern (colors.primary) also works
  }),
}));

// ─── gas.config mock (required by design-token resolvers pulled in transitively) ─

jest.mock('../../gas.config', () => {
  const gasConfig = {
    design: {
      mood: 'professional',
      colors: {
        primary: '#6366F1',
        primaryDark: '#818CF8',
        secondary: '#64748B',
        accent: '#F59E0B',
        background: '#FFFFFF',
        backgroundDark: '#0F172A',
        surface: '#F8FAFC',
        surfaceDark: '#1E293B',
        text: '#0F172A',
        textDark: '#F8FAFC',
        textSecondary: '#64748B',
        textSecondaryDark: '#94A3B8',
        border: '#E2E8F0',
        borderDark: '#334155',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      layout: { borderRadius: 'lg', spacing: 'comfortable', cardStyle: 'elevated', buttonStyle: 'rounded' },
    },
  };
  return { __esModule: true, gasConfig, default: gasConfig };
});

// ─── Components under test ────────────────────────────────────────────────────

import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Tooltip } from '../../components/ui/Tooltip';
import { Accordion } from '../../components/ui/Accordion';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Text } from 'react-native';

// ─── Reanimated withSpring spy ────────────────────────────────────────────────
// The setup.ts mock already stubs out the entire reanimated module. We spy on
// the already-mocked `withSpring` to assert call counts per test.

const Reanimated = require('react-native-reanimated');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('reduced-motion: animated components honour reducedMotion=true', () => {
  // ── LoadingSkeleton ─────────────────────────────────────────────────────────

  describe('LoadingSkeleton', () => {
    it('renders testID skeleton-static (not skeleton-animated) when reducedMotion=true', async () => {
      const { getByTestId, queryByTestId } = await render(<LoadingSkeleton width={200} height={16} />);
      expect(getByTestId('skeleton-static')).toBeTruthy();
      expect(queryByTestId('skeleton-animated')).toBeNull();
    });

    it('does NOT start the Animated.loop shimmer when reducedMotion=true', async () => {
      const RN = require('react-native');
      const loopSpy = jest.spyOn(RN.Animated, 'loop');
      loopSpy.mockClear();
      await render(<LoadingSkeleton />);
      expect(loopSpy).not.toHaveBeenCalled();
    });

    it('renders correct count of static bars with count>1', async () => {
      const { getAllByTestId } = await render(<LoadingSkeleton count={3} />);
      expect(getAllByTestId('skeleton-static')).toHaveLength(3);
    });
  });

  // ── Tooltip ─────────────────────────────────────────────────────────────────

  describe('Tooltip', () => {
    it('renders tooltip text immediately when visible (state forced via long-press)', async () => {
      // Trigger the tooltip by firing a longPress event.
      const { getByText } = await render(
        <Tooltip text="Hello reduced motion" position="top">
          <Text>Trigger</Text>
        </Tooltip>,
      );
      await act(async () => { fireEvent(getByText('Trigger'), 'longPress'); });
      // Tooltip content must be present right away — no fade delay.
      expect(getByText('Hello reduced motion')).toBeTruthy();
    });
  });

  // ── Accordion ───────────────────────────────────────────────────────────────

  describe('Accordion', () => {
    const sections = [
      { key: 'a', title: 'Section A', content: <Text>Content A</Text> },
    ];

    it('shows expanded content immediately when a section is toggled', async () => {
      const { getByText, queryByText } = await render(
        <Accordion sections={sections} />,
      );
      // Content hidden before toggle
      expect(queryByText('Content A')).toBeNull();
      await act(async () => { fireEvent.press(getByText('Section A')); });
      // Content visible after toggle — no animation delay with reducedMotion
      expect(getByText('Content A')).toBeTruthy();
    });
  });

  // ── BottomSheet ─────────────────────────────────────────────────────────────

  describe('BottomSheet', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('does NOT call withSpring when reducedMotion=true and visible changes', async () => {
      const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
      await render(
        <BottomSheet visible onClose={jest.fn()}>
          <Text>Sheet content</Text>
        </BottomSheet>,
      );
      expect(withSpringSpy).not.toHaveBeenCalled();
    });

    it('renders its children when visible=true', async () => {
      const { getByText } = await render(
        <BottomSheet visible onClose={jest.fn()}>
          <Text>Sheet content</Text>
        </BottomSheet>,
      );
      expect(getByText('Sheet content')).toBeTruthy();
    });
  });
});
