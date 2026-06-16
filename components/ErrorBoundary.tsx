/**
 * GAS Template, ErrorBoundary
 *
 * React class component error boundary with retry button.
 *
 * Features:
 * - Catches JavaScript errors in child component tree
 * - Displays a themed error screen with error message
 * - "Try Again" button resets the error state to re-render children
 * - Logs errors to console for debugging
 * - Uses gasConfig colors (primary for button, dark bg)
 *
 * This is a class component because React does not yet support error boundaries
 * as function components (getDerivedStateFromError requires class components).
 *
 * Extracted from ThreadLift, made config-driven.
 *
 * Dependencies: gasConfig
 */

import React from 'react';
import { View, Text, TouchableOpacity, Appearance } from 'react-native';
import { captureException, addBreadcrumb } from '@/lib/sentry';
import { gasConfig } from '../gas.config';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

const primary = gasConfig.design.colors.primary;
const c = gasConfig.design.colors;

/**
 * Resolve the crash-fallback palette to the OS scheme at render time. This is a
 * class component, so it cannot consume ThemeContext via a hook, and a render
 * error may have torn down the provider tree anyway. Reading Appearance keeps
 * the fallback visually consistent with the app's light/dark presentation.
 */
function fallbackColors() {
  const scheme = Appearance.getColorScheme();
  const isDark = scheme !== 'light'; // default to dark when scheme is null/unknown
  return {
    background: isDark ? c.backgroundDark : c.background,
    text: isDark ? c.textDark : c.text,
    textMuted: isDark ? c.textSecondaryDark : c.textSecondary,
  };
}

/**
 * ErrorBoundary, Wraps child components to catch rendering errors.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyScreen />
 *   </ErrorBoundary>
 *
 * Typically wraps the tab navigator in app/(tabs)/_layout.tsx
 * and can wrap individual screens for more granular error isolation.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    captureException(error, { componentStack: errorInfo.componentStack });
    addBreadcrumb('ui', 'Error boundary triggered', { error: error.message });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const fallback = fallbackColors();

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fallback.background,
          padding: 24,
        }}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={{ color: primary, fontSize: 48, marginBottom: 16 }} accessibilityLabel="Error" accessibilityRole="image">!</Text>
        <Text
          style={{
            color: fallback.text,
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            color: fallback.textMuted,
            textAlign: 'center',
            marginBottom: 24,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: primary,
            borderRadius: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
          onPress={() => this.setState({ hasError: false })}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
