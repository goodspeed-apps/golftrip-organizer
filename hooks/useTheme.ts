/**
 * GAS Template, useTheme Hook
 *
 * Manages theme preference (light / dark / system) with AsyncStorage persistence.
 *
 * Features:
 * - Three-way preference: 'light', 'dark', 'system'
 * - System color scheme detection via React Native's useColorScheme
 * - Persists preference to AsyncStorage under a generic @gas: key
 * - Returns resolved scheme ('light' | 'dark') based on preference and system setting
 * - Default preference read from gasConfig.features.darkMode.default
 * - `loaded` flag to prevent flash-of-wrong-theme on startup
 *
 * Extracted from ThreadLift, made generic and config-driven.
 *
 * Dependencies: @react-native-async-storage/async-storage, gas.config
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gasConfig } from '../gas.config';
import { addBreadcrumb } from '@/lib/sentry';

// --- Types ---
export type ColorScheme = 'light' | 'dark' | 'system';

// --- Config-driven constants ---
const THEME_KEY = `@${gasConfig.app.slug}:theme_preference`;
const DEFAULT_PREFERENCE: ColorScheme = gasConfig.features.darkMode.default ?? 'system';

/**
 * useTheme, Theme preference hook.
 *
 * @returns {Object}
 *   - preference: The raw user preference ('light' | 'dark' | 'system')
 *   - resolved: The effective scheme ('light' | 'dark') after resolving 'system'
 *   - setTheme: Async function to update and persist the preference
 *   - loaded: Whether the stored preference has been read from AsyncStorage
 */
export function useTheme() {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ColorScheme>(DEFAULT_PREFERENCE);
  const [loaded, setLoaded] = useState(false);
  const isMounted = useRef(true);

  // Load persisted preference on mount
  useEffect(() => {
    isMounted.current = true;
    AsyncStorage.getItem(THEME_KEY)
      .then((val) => {
        if (!isMounted.current) return;
        if (val === 'light' || val === 'dark' || val === 'system') {
          setPreference(val);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!isMounted.current) return;
        addBreadcrumb('theme', 'Failed to load theme preference from storage');
        setLoaded(true);
      });
    return () => { isMounted.current = false; };
  }, []);

  // Persist preference and update state
  const setTheme = useCallback(async (scheme: ColorScheme) => {
    setPreference(scheme);
    try {
      await AsyncStorage.setItem(THEME_KEY, scheme);
    } catch {
      addBreadcrumb('theme', 'Failed to persist theme preference');
    }
  }, []);

// Resolve 'system' to the actual system scheme, defaulting to 'dark' if unavailable
  const resolved: 'light' | 'dark' =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  return { preference, resolved, setTheme, loaded };
}
