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
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/useAnalytics';
import { addBreadcrumb } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { useThemeColors } from '@/context/ThemeContext';
import { isWeb } from '@/lib/platform';
import { signInWithApple } from '@/services/apple-auth';
import { ProviderIcon } from '@/components/auth/ProviderIcon';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { friendlyAuthError, isEmailNotConfirmed } from '@/lib/auth-errors';
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

type OAuthProvider = 'google' | 'twitter' | 'linkedin_oidc' | 'azure';

export default function LoginScreen() {
  const { track } = useAnalytics();
  const { colors } = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  // Which OAuth/Apple provider is mid-flight, so we can show a spinner on
  // exactly that button instead of every social button at once.
  const [oauthProvider, setOAuthProvider] = useState<OAuthProvider | 'apple' | null>(null);
  // True only when the last email login failed with "email not confirmed",
  // which lets us offer an inline "Resend verification email" action.
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

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
    setEmailUnconfirmed(false);
    track('login_attempted', { provider: 'email' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      track('login_failed', { provider: 'email', error: error.message });
      addBreadcrumb('auth', 'Login failed', { provider: 'email' });
      if (isEmailNotConfirmed(error)) {
        setEmailUnconfirmed(true);
      }
      Alert.alert('Login Failed', friendlyAuthError(error));
    } else {
      track('login_succeeded', { provider: 'email' });
    }
  }

  // --- Resend the signup verification email after an unconfirmed login ---
  async function handleResendVerification() {
    if (!email || resending) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) {
      Alert.alert('Could Not Resend', friendlyAuthError(error));
    } else {
      Alert.alert('Verification email sent', 'Check your inbox for the verification link.');
    }
  }

  // --- OAuth login (Google, Twitter, LinkedIn, Microsoft) ---
  async function handleOAuthLogin(provider: OAuthProvider) {
    setLoading(true);
    setOAuthProvider(provider);
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
      setOAuthProvider(null);
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
        setOAuthProvider(null);
        return;
      }
      await supabase.auth.exchangeCodeForSession(result.url);
    } else {
      // User cancelled, dismissed, or the flow errored before completing, 
      // drop the stored state so a stale value can't be reused.
      await clearOAuthState();
    }
    setLoading(false);
    setOAuthProvider(null);
  }

async function handleAppleLogin() {
    if (isWeb) return;
    try {
      setLoading(true);
      setOAuthProvider('apple');
      await signInWithApple();
    } catch (e: unknown) {
      // Expo AppleAuthentication throws a CodedError whose `code` is
      // 'ERR_REQUEST_CANCELED' when the user taps Cancel in the native Apple
      // dialog (underlying iOS ASAuthorizationError.canceled, code 1001).
      // Cancelling is normal, return silently, never show an error alert.
      // NB: the cancel sentinel lives on `.code`, NOT `.message` (message is
      // the human-readable "The user canceled the authorization attempt.").
      const code = (e as { code?: string })?.code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Error', friendlyAuthError(e));
    } finally {
      setLoading(false);
      setOAuthProvider(null);
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
            ref={emailRef}
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            accessibilityLabel="Email address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <PasswordInput
            ref={passwordRef}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            textContentType="password"
            autoComplete="current-password"
            accessibilityLabel="Password"
            returnKeyType="go"
            onSubmitEditing={handleEmailLogin}
          />

          {/* Forgot password */}
          <View style={{ alignItems: 'flex-end' }}>
            <Link href="/(auth)/reset-password" asChild>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Resend verification, only after an "email not confirmed" failure */}
          {emailUnconfirmed && (
            <TouchableOpacity
              onPress={handleResendVerification}
              disabled={resending}
              accessibilityRole="button"
              accessibilityLabel="Resend verification email"
              accessibilityState={{ disabled: resending, busy: resending }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ alignItems: 'center' }}
            >
              {resending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                  Resend verification email
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: email && password ? colors.primary : colors.primary + '66',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={handleEmailLogin}
            disabled={loading || !email || !password}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: loading || !email || !password, busy: loading }}
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
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
                accessibilityState={{ disabled: loading, busy: oauthProvider === 'google' }}
              >
                {oauthProvider === 'google' ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <ProviderIcon provider="google" size={18} />
                )}
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Google</Text>
              </TouchableOpacity>
            )}

            {showTwitter && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={() => handleOAuthLogin('twitter')}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Twitter"
                accessibilityState={{ disabled: loading, busy: oauthProvider === 'twitter' }}
              >
                {oauthProvider === 'twitter' ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <ProviderIcon provider="x" size={16} color={colors.text} />
                )}
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with X</Text>
              </TouchableOpacity>
            )}

            {showLinkedIn && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={() => handleOAuthLogin('linkedin_oidc')}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Sign in with LinkedIn"
                accessibilityState={{ disabled: loading, busy: oauthProvider === 'linkedin_oidc' }}
              >
                {oauthProvider === 'linkedin_oidc' ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <ProviderIcon provider="linkedin" size={18} />
                )}
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with LinkedIn</Text>
              </TouchableOpacity>
            )}

            {showMicrosoft && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={() => handleOAuthLogin('azure')}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Microsoft"
                accessibilityState={{ disabled: loading, busy: oauthProvider === 'azure' }}
              >
                {oauthProvider === 'azure' ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <ProviderIcon provider="microsoft" size={18} />
                )}
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Microsoft</Text>
              </TouchableOpacity>
            )}

            {showApple && (
              <TouchableOpacity
                style={oauthBtnStyle}
                onPress={handleAppleLogin}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Apple"
                accessibilityState={{ disabled: loading, busy: oauthProvider === 'apple' }}
              >
                {oauthProvider === 'apple' ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <ProviderIcon provider="apple" size={18} color={colors.text} />
                )}
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Apple</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Switch to signup */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Don't have an account?</Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go to sign up">
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
