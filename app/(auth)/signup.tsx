/**
 * GAS Template, Signup Screen
 *
 * Email/password/confirm signup with config-driven OAuth buttons.
 * Email verification flow with resend capability.
 *
 * OAuth providers are shown conditionally based on gasConfig.features.auth:
 * - Google: shown if gasConfig.features.auth.google
 * - Apple: shown if gasConfig.features.auth.apple AND isAvailableAsync()
 * - Twitter: shown if gasConfig.features.auth.twitter
 *
 * After email signup, shows a verification-sent screen with resend option.
 * OAuth signup bypasses email verification (handled by provider).
 *
 * All colors come from useThemeColors(), never hardcoded.
 * Uses SafeAreaView from 'react-native-safe-area-context' (CRITICAL).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/useAnalytics';
import { captureException, addBreadcrumb } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { useThemeColors } from '@/context/ThemeContext';
import { signInWithApple } from '@/services/apple-auth';
import {
  generateAndStoreOAuthState,
  verifyAndClearOAuthState,
  clearOAuthState,
} from '@/lib/crypto';
import { gasConfig } from '../../gas.config';

// Complete any pending auth sessions in the browser.
WebBrowser.maybeCompleteAuthSession();

// --- Config-driven auth flags ---
const AUTH = gasConfig.features.auth;
const SCHEME = gasConfig.app.scheme;
const APP_NAME = gasConfig.app.name;

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

export default function SignupScreen() {
  const { track } = useAnalytics();
  const { colors } = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

// Capture mount-time once so re-renders don't reset the screen-load baseline.
  const screenStartRef = useRef(Date.now());
  useEffect(() => {
    track('signup_screen_viewed');
    trackScreenLoad('signup', screenStartRef.current);
    if (AUTH.apple) {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  // --- Shared styles (memoized to avoid re-creation) ---
  const oauthBtnStyle = useMemo(() => ({
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
  }), [colors.border, colors.surface]);

  const inputStyle = useMemo(() => ({
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  }), [colors.border, colors.surface, colors.text]);

  // --- Password validation ---
  const handleConfirmPasswordChange = useCallback((val: string) => {
    setConfirmPassword(val);
    if (password && val && val !== password) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
  }, [password]);

  const handlePasswordChange = useCallback((val: string) => {
    setPassword(val);
    if (confirmPassword && val !== confirmPassword) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
  }, [confirmPassword]);

  // --- Email/password signup ---
  const handleEmailSignup = useCallback(async () => {
    if (!email.trim()) { Alert.alert('Missing Email', 'Please enter your email address.'); return; }
    if (!password) { Alert.alert('Missing Password', 'Please enter a password.'); return; }
    if (password.length < 8) { Alert.alert('Weak Password', 'Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setPasswordError('Passwords do not match'); return; }

    setLoading(true);
    const emailRedirectTo = makeRedirectUri({
      scheme: SCHEME,
      path: 'auth/callback',
    });
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo },
    });
    setLoading(false);
    if (error) {
      track('signup_failed', { provider: 'email', error: error.message });
      addBreadcrumb('auth', 'Signup failed', { provider: 'email' });
      if (error.message.includes('already registered')) {
        Alert.alert('Account Exists', 'An account with this email already exists. Try signing in instead.');
      } else {
        Alert.alert('Signup Failed', error.message);
      }
    } else {
      setVerificationSent(true);
      track('signup_attempted', { provider: 'email' });
    }
  }, [email, password, confirmPassword, track]);

  // --- OAuth signup (Google, Twitter, LinkedIn, Microsoft) ---
  const handleOAuthSignup = useCallback(async (provider: 'google' | 'twitter' | 'linkedin_oidc' | 'azure') => {
    const names: Record<string, string> = { google: 'Google', twitter: 'X (Twitter)', linkedin_oidc: 'LinkedIn', azure: 'Microsoft' };
    const name = names[provider] ?? provider;
    setLoading(true);
    const redirectTo = makeRedirectUri({ scheme: SCHEME, path: 'auth/callback' });

    // Generate a cryptographically random state, persist it to secure store,
    // and forward it to the provider. Verifying this value on the callback
    // prevents deep-link spoofing and code replay (P7-6 / H-6).
    const state = await generateAndStoreOAuthState();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { state },
      },
    });
    if (error || !data?.url) {
      await clearOAuthState();
      setLoading(false);
      Alert.alert(
        `${name} Not Available`,
        `${name} sign-in is not yet enabled. Please sign up with email${appleAvailable ? ' or Apple' : ''}.`
      );
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      // Validate the state echoed back by the provider before exchanging the
      // code. `verifyAndClearOAuthState` clears the stored value on every call,
      // so a leaked code can never be replayed against a stale state.
      const returnedState = extractStateFromCallbackUrl(result.url);
      const stateOk = await verifyAndClearOAuthState(returnedState);
      if (!stateOk) {
        addBreadcrumb('auth', 'OAuth state mismatch', { provider });
        track('signup_failed', { provider, error: 'state_mismatch' });
        Alert.alert('Sign In Failed', 'Security check failed. Please try again.');
        setLoading(false);
        return;
      }
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (sessionError) {
        Alert.alert('Sign In Failed', sessionError.message);
      } else {
        track('signup_oauth_success', { provider });
      }
    } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
      await clearOAuthState();
      Alert.alert(`${name} Sign In Failed`, 'Authentication was not completed. Please try again.');
    } else {
      // User cancelled or dismissed the in-app browser, drop the stored
      // state so a stale value can't be reused.
      await clearOAuthState();
    }
    setLoading(false);
  }, [track, appleAvailable]);

const handleAppleSignup = useCallback(async () => {
    try {
      setLoading(true);
      await signInWithApple();
      track('signup_apple_success');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Apple Sign Up failed';
      if (msg !== 'ERR_REQUEST_CANCELED') Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [track]);

  // Determine if any OAuth buttons will be shown.
  const showGoogle = AUTH.google;
  const showApple = AUTH.apple && appleAvailable;
  const showTwitter = AUTH.twitter;
  const showLinkedIn = AUTH.linkedin === true;
  const showMicrosoft = AUTH.microsoft === true;
  const hasOAuth = showGoogle || showApple || showTwitter || showLinkedIn || showMicrosoft;

  // --- Verification sent screen ---
  if (verificationSent) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: colors.background }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📬</Text>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
          Check your email
        </Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 8, lineHeight: 22 }}>
          We sent a verification link to{' '}
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{email}</Text>.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
          Tap the link in the email to activate your account. Check your spam folder if you don't see it within a few minutes.
        </Text>
        <TouchableOpacity
          style={{
            height: 48, width: '100%', borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}
          onPress={() => router.replace('/(auth)/login')}
          accessibilityLabel="Back to login"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Back to Login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleEmailSignup}
          accessibilityLabel="Resend verification email"
        >
          <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500' }}>Resend email</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Signup form ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={{ alignItems: 'center', paddingTop: 40, paddingBottom: 32, gap: 12 }}>
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
              <Text style={{ fontSize: 15, color: colors.textSecondary }}>Create your account</Text>
            </View>
          </View>

          {/* OAuth buttons ABOVE email form, scroll out of view when keyboard opens */}
          {hasOAuth && (
            <View style={{ gap: 10, marginBottom: 20 }}>
              {showGoogle && (
                <TouchableOpacity
                  style={oauthBtnStyle}
                  onPress={() => handleOAuthSignup('google')}
                  disabled={loading}
                  accessibilityLabel="Continue with Google"
                >
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#4285F4' }}>G</Text>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Google</Text>
                </TouchableOpacity>
              )}

              {showTwitter && (
                <TouchableOpacity
                  style={oauthBtnStyle}
                  onPress={() => handleOAuthSignup('twitter')}
                  disabled={loading}
                  accessibilityLabel="Continue with X"
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1DA1F2' }}>X</Text>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with X</Text>
                </TouchableOpacity>
              )}

              {showLinkedIn && (
                <TouchableOpacity
                  style={oauthBtnStyle}
                  onPress={() => handleOAuthSignup('linkedin_oidc')}
                  disabled={loading}
                  accessibilityLabel="Continue with LinkedIn"
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0A66C2' }}>in</Text>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with LinkedIn</Text>
                </TouchableOpacity>
              )}

              {showMicrosoft && (
                <TouchableOpacity
                  style={oauthBtnStyle}
                  onPress={() => handleOAuthSignup('azure')}
                  disabled={loading}
                  accessibilityLabel="Continue with Microsoft"
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#00A4EF' }}>⊞</Text>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Microsoft</Text>
                </TouchableOpacity>
              )}

              {showApple && (
                <TouchableOpacity
                  style={oauthBtnStyle}
                  onPress={handleAppleSignup}
                  disabled={loading}
                  accessibilityLabel="Continue with Apple"
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}></Text>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Divider */}
          {hasOAuth && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>or sign up with email</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
          )}

          {/* Email form */}
          <View style={{ gap: 12, marginBottom: 20 }}>
            <TextInput
              ref={emailRef}
              style={inputStyle}
              placeholder="Email address"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel="Email address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
            <TextInput
              ref={passwordRef}
              style={inputStyle}
              placeholder="Password (min 8 characters)"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry
              autoComplete="new-password"
              accessibilityLabel="Password"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              blurOnSubmit={false}
            />
            <View>
              <TextInput
                ref={confirmPasswordRef}
                style={[inputStyle, passwordError ? { borderColor: colors.error } : null]}
                placeholder="Confirm password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry
                autoComplete="new-password"
                accessibilityLabel="Confirm password"
                returnKeyType="done"
                onSubmitEditing={handleEmailSignup}
              />
              {passwordError ? (
                <Text style={{ color: colors.error, fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                  {passwordError}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: email && password && confirmPassword && !passwordError
                  ? colors.primary
                  : colors.primary + '66', // 40% opacity when disabled
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={handleEmailSignup}
              disabled={loading || !!passwordError}
              accessibilityLabel="Create account"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Legal */}
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </Text>

          {/* Switch to login */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity accessibilityLabel="Go to login">
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
