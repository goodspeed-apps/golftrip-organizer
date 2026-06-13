/**
 * Tests for hooks/useAppState.ts, hooks/useOnForeground.ts, hooks/useOnBackground.ts
 */

import { renderHook, act } from '@testing-library/react-native';

// ─── AppState mock setup ──────────────────────────────────────────────────────

let appStateChangeListener: ((state: string) => void) | null = null;
const mockRemove = jest.fn();

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((_event: string, cb: (state: string) => void) => {
      appStateChangeListener = cb;
      return { remove: mockRemove };
    }),
  },
}));

// Ensure lib/platform.isWeb is false (native path)
jest.mock('../../lib/platform', () => ({
  isWeb: false,
  isIOS: true,
  isAndroid: false,
  platformVersion: 17,
  isTablet: false,
  hasNotch: true,
  appVersion: '1.0.0',
  buildNumber: '1',
}));

// Pin gas.config to template values so a generated app's customized config
// (i18n locales, push channels, media limits, etc.) can never break these
// app-state tests. Provide only the shape the implementation might read.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    features: { i18n: { enabled: true, locales: ['en', 'es'], defaultLocale: 'en' } },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

import { useAppState } from '../../hooks/useAppState';
import { useOnForeground } from '../../hooks/useOnForeground';
import { useOnBackground } from '../../hooks/useOnBackground';
import { AppState } from 'react-native';

beforeEach(() => {
  appStateChangeListener = null;
  mockRemove.mockClear();
  (AppState.addEventListener as jest.Mock).mockClear();
  (AppState.addEventListener as jest.Mock).mockImplementation(
    (_event: string, cb: (state: string) => void) => {
      appStateChangeListener = cb;
      return { remove: mockRemove };
    },
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── useAppState ──────────────────────────────────────────────────────────────

describe('useAppState', () => {
  test('returns initial state from AppState.currentState', async () => {
    const { result } = await renderHook(() => useAppState());
    expect(result.current).toBe('active');
  });

  test('updates state when AppState fires a change event', async () => {
    const { result } = await renderHook(() => useAppState());

    await act(async () => {
      appStateChangeListener?.('background');
    });

    expect(result.current).toBe('background');
  });

  test('updates back to active after returning to foreground', async () => {
    const { result } = await renderHook(() => useAppState());

    await act(async () => { appStateChangeListener?.('background'); });
    await act(async () => { appStateChangeListener?.('active'); });

    expect(result.current).toBe('active');
  });

  test('removes listener on unmount (no leak)', async () => {
    const { unmount } = await renderHook(() => useAppState());
    // Wrap unmount in act() so React drains its effect-cleanup queue under
    // the fake-timer / testing-library setup; otherwise sub.remove() never runs.
    await act(async () => {
      unmount();
    });
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});

// ─── useOnForeground ──────────────────────────────────────────────────────────

describe('useOnForeground', () => {
  test('fires callback on background → active transition', async () => {
    const cb = jest.fn();
    await renderHook(() => useOnForeground(cb));

    await act(async () => { appStateChangeListener?.('background'); });
    await act(async () => { appStateChangeListener?.('active'); });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('does NOT fire callback on first mount', async () => {
    const cb = jest.fn();
    await renderHook(() => useOnForeground(cb));
    expect(cb).not.toHaveBeenCalled();
  });

  test('fires callback on inactive → active transition', async () => {
    const cb = jest.fn();
    await renderHook(() => useOnForeground(cb));

    await act(async () => { appStateChangeListener?.('inactive'); });
    await act(async () => { appStateChangeListener?.('active'); });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('does NOT fire when already active', async () => {
    const cb = jest.fn();
    await renderHook(() => useOnForeground(cb));

    await act(async () => { appStateChangeListener?.('active'); });

    expect(cb).not.toHaveBeenCalled();
  });
});

// ─── useOnBackground ─────────────────────────────────────────────────────────

describe('useOnBackground', () => {
  test('fires callback on active → background transition', async () => {
    const cb = jest.fn();
    await renderHook(() => useOnBackground(cb));

    await act(async () => { appStateChangeListener?.('background'); });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('does NOT fire callback on first mount', async () => {
    const cb = jest.fn();
    await renderHook(() => useOnBackground(cb));
    expect(cb).not.toHaveBeenCalled();
  });

  test('does NOT fire on active → inactive (not background)', async () => {
    const cb = jest.fn();
    await renderHook(() => useOnBackground(cb));

    await act(async () => { appStateChangeListener?.('inactive'); });

    expect(cb).not.toHaveBeenCalled();
  });
});