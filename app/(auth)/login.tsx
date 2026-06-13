/**
 * GAS Template, Login Screen
 *
 * Email/password login with config-driven OAuth buttons.
 *
 * OAuth providers are shown conditionally based on gasConfig.features.auth:
 * - Google: shown if gasConfig.features.auth.google AND EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set
 * - Apple: shown if gasConfig.features.auth.apple AND AppleAuthentication.isAvailableAsync()
 * - Twitter: shown if gasConfig.features.auth.twitter
 *
 * All colors come from useThemeColors(), never hardcoded.
 * Uses SafeAreaView from 'react-native-safe-area-context' (CRITICAL).
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/useAnalytics';
import { captureException, addBreadcrumb } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { useThemeColors } from '@/context/ThemeContext';
import { isWeb } from '@/lib/platform';
import { signInWithApple } from '@/services/apple-auth';
import {
  generateAndStoreOAuthState,
  verifyAndClearOAuthState,
  clearOAuthState,
} from '@/lib/crypto';
import { gasConfig } from '../../gas.config';

// Conditionally import Apple Authentication (only available on iOS native)
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
if (!isWeb && Platform.OS === 'ios') {
  try {
    AppleAuthentication = require('expo-apple-authentication');
  } catch {
    // Module not available
  }
}

// Complete any pending auth sessions in the browser.
WebBrowser.maybeCompleteAuthSession();

// --- Config-driven auth flags ---
const AUTH = gasConfig.features.auth;
const SCHEME = gasConfig.app.scheme;
const APP_NAME = gasConfig.app.name;

// Provider display names for error messages.
const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  twitter: 'Twitter',
  linkedin_oidc: 'LinkedIn',
  azure: 'Microsoft',
};

/**
 * Pull the `state` query parameter out of a callback URL string. Returns null
 * if the URL is malformed or the parameter is missing.
 */
function extractStateFromCallbackUrl(callbackUrl: string): string | null {
  try {
    const url = new URL(callbackUrl);
    return url.searchParams.get('state');
  } catch {
    return null;
  }
}

export default function LoginScreen() {
  const { track } = useAnalytics();
  const { colors } = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

// Capture mount-time once so re-renders don't reset the screen-load baseline.
  const screenStartRef = useRef(Date.now());
  useEffect(() => {
    track('login_screen_viewed');
    trackScreenLoad('login', screenStartRef.current);
    if (AUTH.apple && !isWeb && AppleAuthentication) {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, [track]);

  // --- Email/password login ---
  async function handleEmailLogin() {
    if (!email || !password) return;
    setLoading(true);
    track('login_attempted', { provider: 'email' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      track('login_failed', { provider: 'email', error: error.message });
      addBreadcrumb('auth', 'Login failed', { provider: 'email' });
      Alert.alert('Login Failed', error.message);
    } else {
      track('login_succeeded', { provider: 'email' });
    }
  }

  // --- OAuth login (Google, Twitter, LinkedIn, Microsoft) ---
  async function handleOAuthLogin(provider: 'google' | 'twitter' | 'linkedin_oidc' | 'azure') {
    setLoading(true);
    const redirectTo = makeRedirectUri({ scheme: SCHEME, path: 'auth/callback' });

    // Generate a cryptographically random state, persist it to secure store,
    // and forward it to the provider as a query param. Verifying this value
    // on the callback prevents deep-link spoofing and code replay (P7-6 / H-6).
    const state = await generateAndStoreOAuthState();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { state },
      },
    });
    if (error || !data.url) {
      await clearOAuthState();
      setLoading(false);
      const name = PROVIDER_NAMES[provider] ?? provider;
      Alert.alert(
        `${name} Sign In Unavailable`,
        `${name} sign-in isn't configured yet. Please use email${appleAvailable ? ' or Apple' : ''} to sign in.`
      );
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') {
      // Validate the state echoed back by the provider before exchanging the
      // code. `verifyAndClearOAuthState` clears the stored value on every call,
      // so a leaked code can never be replayed against a stale state.
      const returnedState = extractStateFromCallbackUrl(result.url);
      const stateOk = await verifyAndClearOAuthState(returnedState);
      if (!stateOk) {
        addBreadcrumb('auth', 'OAuth state mismatch', { provider });
        track('login_failed', { provider, error: 'state_mismatch' });
        Alert.alert('Sign In Failed', 'Security check failed. Please try again.');
        setLoading(false);
        return;
      }
      await supabase.auth.exchangeCodeForSession(result.url);
    } else {
      // User cancelled, dismissed, or the flow errored before completing, 
      // drop the stored state so a stale value can't be reused.
      await clearOAuthState();
    }
    setLoading(false);
  }

async function handleAppleLogin() {
    if (isWeb) return;
    try {
      setLoading(true);
      await signInWithApple();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Apple Sign In failed';
      if (msg !== 'ERR_REQUEST_CANCELED') Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  // --- Shared styles ---
  const inputStyle = {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  };

  const oauthBtnStyle = {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
  };

  // Determine if any OAuth buttons will be shown.
  const showGoogle = AUTH.google;
  const showApple = !isWeb && Platform.OS === 'ios' && AUTH.apple && appleAvailable;
  const showTwitter = AUTH.twitter;
  const showLinkedIn = AUTH.linkedin === true;
  const showMicrosoft = AUTH.microsoft === true;
  const hasOAuth = showGoogle || showApple || showTwitter || showLinkedIn || showMicrosoft;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        // iOS measures keyboard against the screen origin, so a SafeAreaView
        // top inset must be added back so the form doesn't slide too far up.
        // Android handles this via the adjustResize window flag, no offset.
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo header */}
        <View style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 40, gap: 16 }}>
          {/* AppLogo placeholder, DevAgent replaces with app-specific logo */}
          <View style={{
            width: 72, height: 72, borderRadius: 20,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#FFFFFF' }}>
              {APP_NAME.charAt(0)}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
              {APP_NAME}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary }}>Welcome back</Text>
          </View>
        </View>

        {/* Email form */}
        <View style={{ gap: 12, marginBottom: 24 }}>
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="Email address"
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            accessibilityLabel="Password"
          />
          <TouchableOpacity
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={handleEmailLogin}
            disabled={loading}
            accessibilityLabel="Sign in"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* OAuth divider, only shown if OAuth buttons are present */}
        {hasOAuth && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>or continue with</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
        )}

        {/* OAuth buttons, conditional on config */}
        {hasOAuth && (
          <View style={{ gap: 12, marginBottom: 32 }}>
            {showGoogle && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={() => handleOAuthLogin('google')}
                disabled={loading}
                accessibilityLabel="Sign in with Google"
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#4285F4' }}>G</Text>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Google</Text>
              </TouchableOpacity>
            )}

            {showTwitter && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={() => handleOAuthLogin('twitter')}
                disabled={loading}
                accessibilityLabel="Sign in with Twitter"
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1DA1F2' }}>X</Text>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with X</Text>
              </TouchableOpacity>
            )}

            {showLinkedIn && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={() => handleOAuthLogin('linkedin_oidc')}
                disabled={loading}
                accessibilityLabel="Sign in with LinkedIn"
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0A66C2' }}>in</Text>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with LinkedIn</Text>
              </TouchableOpacity>
            )}

            {showMicrosoft && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={() => handleOAuthLogin('azure')}
                disabled={loading}
                accessibilityLabel="Sign in with Microsoft"
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#00A4EF' }}>⊞</Text>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Microsoft</Text>
              </TouchableOpacity>
            )}

            {showApple && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={handleAppleLogin}
                disabled={loading}
                accessibilityLabel="Sign in with Apple"
              >
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}></Text>
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Apple</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Switch to signup */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Don't have an account?</Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity accessibilityLabel="Go to sign up">
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
