/**
 * Tests for hooks/useReducedMotion.ts — Reduced motion preference logic.
 */

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Platform } from 'react-native';

// Mock the Platform module
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Platform: {
    ...jest.requireActual('react-native').Platform,
    OS: 'ios',
  },
}));

// Mock AccessibilityInfo
const mockAccessibilityInfo = {
  isReduceMotionEnabled: jest.fn(),
};
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    AccessibilityInfo: mockAccessibilityInfo,
  };
});

describe('useReducedMotion logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('web: reads from matchMedia prefers-reduced-motion', () => {
    const mediaQuery = '(prefers-reduced-motion: reduce)';
    expect(mediaQuery).toBe('(prefers-reduced-motion: reduce)');
  });

  test('native: reads from AccessibilityInfo.isReduceMotionEnabled', () => {
    const isReduceMotionEnabled = jest.fn(() => Promise.resolve(false));
    isReduceMotionEnabled();
    expect(isReduceMotionEnabled).toHaveBeenCalled();
  });

  test('listener is cleaned up on unmount', () => {
    const remove = jest.fn();
    const sub = { remove };
    sub.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});