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
import { View, Text, TouchableOpacity } from 'react-native';
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
const bgDark = gasConfig.design.colors.backgroundDark;
const textMuted = gasConfig.design.colors.textSecondaryDark;

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

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bgDark,
          padding: 24,
        }}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={{ color: primary, fontSize: 48, marginBottom: 16 }} accessibilityLabel="Error" accessibilityRole="image">!</Text>
        <Text
          style={{
            color: '#FFFFFF',
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
            color: textMuted,
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
          accessibilityLabel="Try again"
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
