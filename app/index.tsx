/**
 * GAS Template, Splash / Entry Screen
 *
 * Routes to auth or tabs based on session state and onboarding completion.
 *
 * Decision tree:
 * 1. If session exists -> go to first tab screen
 * 2. If user has onboarded before (no session) -> go to login
 * 3. If first launch (no session, no onboarding) -> go to onboarding welcome
 *
 * Uses AsyncStorage key '@{slug}:has_onboarded' for onboarding state.
 *
 * Shows app name + tagline alongside the spinner so the screen is never blank
 * during the brief routing decision. This is real branded UX (users see the
 * app name on cold start) and it also satisfies the worker's web render-gate
 * (which needs >=3 DOM elements or >=10 chars of text on the home root, so
 * a bare ActivityIndicator would otherwise read as a blank screen on web).
 */

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { useThemeColors } from '../context/ThemeContext';
import { gasConfig } from '../gas.config';

const ONBOARDING_KEY = `@${gasConfig.app.slug}:has_onboarded`;

export default function Splash() {
  const { session, loading } = useAuth();
  const { colors } = useThemeColors();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(v => setHasOnboarded(v === 'true'));
  }, []);

  // Loading splash. Renders branded content (name + tagline) and the spinner
  // so cold-start always shows the app's identity, never just a bare spinner.
  if (loading || hasOnboarded === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          paddingHorizontal: 24,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          {gasConfig.app.name}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: 32,
            maxWidth: 320,
          }}
          numberOfLines={2}
        >
          {gasConfig.app.description}
        </Text>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Determine the first tab route from config.
  const firstTab = gasConfig.navigation.tabs[0]?.file ?? 'index';

  if (session) return <Redirect href={`/(tabs)/${firstTab}` as any} />;
  if (hasOnboarded) return <Redirect href="/(auth)/login" />;

  // First launch: go to onboarding welcome (or login if onboarding is disabled).
  if (gasConfig.features.onboarding.enabled) {
    return <Redirect href="/(auth)/onboarding/welcome" />;
  }
  return <Redirect href="/(auth)/login" />;
}
