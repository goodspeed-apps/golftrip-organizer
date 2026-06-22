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
import AppLogo from '@/components/AppLogo';
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
      // dialog
      const err = e as { code?: string; message?: string };
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In Failed', err?.message ?? 'Please try again.');
      }
    } finally {
      setLoading(false);
      setOAuthProvider(null);
    }
  }

  // Derive boolean flags from config for conditional rendering.
  // Cast to boolean explicitly to avoid literal-type comparison issues.
  const showGoogle = Boolean(AUTH.google) && !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const showApple = Boolean(AUTH.apple) && appleAvailable;
  const showTwitter = Boolean(AUTH.twitter);
  const showLinkedIn = Boolean(AUTH.linkedin);
  const showMicrosoft = Boolean(AUTH.microsoft);

  const hasOAuthProviders = showGoogle || showApple || showTwitter || showLinkedIn || showMicrosoft;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 32 }}>
            <AppLogo size={64} />
            <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 16 }}>
              {APP_NAME}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 6 }}>
              Sign in to continue
            </Text>
          </View>

          {/* OAuth Buttons */}
          {hasOAuthProviders && (
            <View style={{ gap: 10, marginBottom: 20 }}>
              {showGoogle && (
                <TouchableOpacity
                  onPress={() => handleOAuthLogin('google')}
                  disabled={loading}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    opacity: loading ? 0.7 : 1,
                  }}
                  accessibilityLabel="Sign in with Google"
                >
                  {oauthProvider === 'google' ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <ProviderIcon provider="google" size={18} color={colors.text} />
                  )}
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    Continue with Google
                  </Text>
                </TouchableOpacity>
              )}

              {showApple && (
                <TouchableOpacity
                  onPress={handleAppleLogin}
                  disabled={loading}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    opacity: loading ? 0.7 : 1,
                  }}
                  accessibilityLabel="Sign in with Apple"
                >
                  {oauthProvider === 'apple' ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <ProviderIcon provider="apple" size={18} color={colors.text} />
                  )}
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    Continue with Apple
                  </Text>
                </TouchableOpacity>
              )}

              {showTwitter && (
                <TouchableOpacity
                  onPress={() => handleOAuthLogin('twitter')}
                  disabled={loading}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    opacity: loading ? 0.7 : 1,
                  }}
                  accessibilityLabel="Sign in with Twitter"
                >
                  {oauthProvider === 'twitter' ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <ProviderIcon provider="x" size={18} color={colors.text} />
                  )}
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    Continue with Twitter
                  </Text>
                </TouchableOpacity>
              )}

              {showLinkedIn && (
                <TouchableOpacity
                  onPress={() => handleOAuthLogin('linkedin_oidc')}
                  disabled={loading}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    opacity: loading ? 0.7 : 1,
                  }}
                  accessibilityLabel="Sign in with LinkedIn"
                >
                  {oauthProvider === 'linkedin_oidc' ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <ProviderIcon provider="linkedin" size={18} color={colors.text} />
                  )}
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    Continue with LinkedIn
                  </Text>
                </TouchableOpacity>
              )}

              {showMicrosoft && (
                <TouchableOpacity
                  onPress={() => handleOAuthLogin('azure')}
                  disabled={loading}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    opacity: loading ? 0.7 : 1,
                  }}
                  accessibilityLabel="Sign in with Microsoft"
                >
                  {oauthProvider === 'azure' ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <ProviderIcon provider="microsoft" size={18} color={colors.text} />
                  )}
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    Continue with Microsoft
                  </Text>
                </TouchableOpacity>
              )}

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
            </View>
          )}

          {/* Email/Password Form */}
          <View style={{ gap: 12 }}>
            <TextInput
              ref={emailRef}
              style={{
                height: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: 16,
                fontSize: 16,
                color: colors.text,
              }}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <PasswordInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              returnKeyType="done"
              onSubmitEditing={handleEmailLogin}
              ref={passwordRef}
            />

            {emailUnconfirmed && (
              <View style={{
                backgroundColor: colors.warning + '20',
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.warning + '40',
              }}>
                <Text style={{ color: colors.text, fontSize: 13, marginBottom: 8 }}>
                  Please verify your email before signing in.
                </Text>
                <TouchableOpacity
                  onPress={handleResendVerification}
                  disabled={resending}
                  accessibilityLabel="Resend verification email"
                >
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                    {resending ? 'Sending...' : 'Resend verification email'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={handleEmailLogin}
              disabled={loading || !email || !password}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading || !email || !password ? 0.6 : 1,
              }}
              accessibilityLabel="Sign in"
            >
              {loading && oauthProvider === null ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity accessibilityLabel="Forgot password">
                <Text style={{ color: colors.primary, fontSize: 14 }}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Sign up link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Don't have an account? </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity accessibilityLabel="Create account">
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
