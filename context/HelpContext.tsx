/**
 * GAS Template, HelpContext
 *
 * Manages the "help dismissed" state for in-app help/onboarding overlays.
 *
 * Features:
 * - Persists dismissed state to AsyncStorage under a generic @gas: key
 * - Provides dismiss() and reset() actions
 * - Loads persisted state on mount (no flash of help content after dismissal)
 * - `loaded` flag for conditional rendering during hydration
 *
 * Use this context to control:
 * - Help buttons (show ? icon, hide if dismissed)
 * - Help sheets, walkthrough modals, coach marks
 * - "How to use" overlays on first launch
 *
 * Extracted from ThreadLift, made generic.
 *
 * Dependencies: @react-native-async-storage/async-storage
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gasConfig } from '../gas.config';

// --- App-scoped AsyncStorage key ---
const HELP_KEY = `@${gasConfig.app.slug}:help_dismissed`;

type HelpContextValue = {
  /** Whether the user has dismissed the help overlay */
  dismissed: boolean;
  /** Whether the persisted state has been loaded from storage */
  loaded: boolean;
  /** Dismiss the help overlay and persist the preference */
  dismiss: () => Promise<void>;
  /** Reset to show help again (e.g., from settings) and clear persisted preference */
  reset: () => Promise<void>;
};

const HelpContext = createContext<HelpContextValue>({
  dismissed: false,
  loaded: false,
  dismiss: async () => {},
  reset: async () => {},
});

/**
 * HelpProvider, Wrap your app's root layout with this provider.
 *
 * Usage in app/_layout.tsx:
 *   import { HelpProvider } from '@/context/HelpContext';
 *
 *   export default function RootLayout() {
 *     return (
 *       <HelpProvider>
 *         <ThemeProvider>
 *           <Stack />
 *         </ThemeProvider>
 *       </HelpProvider>
 *     );
 *   }
 */
export function HelpProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load persisted dismissed state on mount
  useEffect(() => {
    AsyncStorage.getItem(HELP_KEY)
      .then(val => {
        setDismissed(val === 'true');
        setLoaded(true);
      })
      .catch(() => {
        setDismissed(false);
        setLoaded(true);
      });
  }, []);

  // Dismiss help and persist
  const dismiss = useCallback(async () => {
    setDismissed(true);
    await AsyncStorage.setItem(HELP_KEY, 'true');
  }, []);

  // Reset help (show again) and clear persistence
  const reset = useCallback(async () => {
    setDismissed(false);
    await AsyncStorage.removeItem(HELP_KEY);
  }, []);

  return (
    <HelpContext.Provider value={{ dismissed, loaded, dismiss, reset }}>
      {children}
    </HelpContext.Provider>
  );
}

/**
 * useHelp, Access help context from any component.
 *
 * @returns HelpContextValue with dismissed state and actions
 *
 * Usage:
 *   const { dismissed, dismiss, reset } = useHelp();
 *
 *   // Conditionally show help button:
 *   {!dismissed && <HelpButton onPress={() => showHelpSheet()} />}
 *
 *   // In help sheet:
 *   <Button title="Got it" onPress={dismiss} />
 *
 *   // In settings screen:
 *   <Button title="Show Help Again" onPress={reset} />
 */
export function useHelp() {
  return useContext(HelpContext);
}
