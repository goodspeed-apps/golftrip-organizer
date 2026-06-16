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
import { addBreadcrumb } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { useThemeColors } from '@/context/ThemeContext';
import { signInWithApple } from '@/services/apple-auth';
import { ProviderIcon } from '@/components/auth/ProviderIcon';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { friendlyAuthError } from '@/lib/auth-errors';
import { MailCheck } from 'lucide-react-native';
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

type OAuthProvider = 'google' | 'twitter' | 'linkedin_oidc' | 'azure';

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
  // Which OAuth/Apple provider is mid-flight, so we can show a spinner on
  // exactly that button instead of every social button at once.
  const [oauthProvider, setOAuthProvider] = useState<OAuthProvider | 'apple' | null>(null);
  // Resend-verification state for the "check your email" screen.
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resentConfirmation, setResentConfirmation] = useState(false);

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

  // Tick the resend cooldown down to zero once per second while it's active.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
        Alert.alert('Signup Failed', friendlyAuthError(error));
      }
    } else {
      setVerificationSent(true);
      track('signup_attempted', { provider: 'email' });
    }
  }, [email, password, confirmPassword, track]);

  // --- Resend the verification email (verification-sent screen) ---
  // Re-sends just the verification link instead of re-running the full signup,
  // with a 30s cooldown so the button can't be hammered.
  const handleResendVerification = useCallback(async () => {
    if (resending || resendCooldown > 0 || !email.trim()) return;
    setResending(true);
    setResentConfirmation(false);
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setResending(false);
    if (error) {
      Alert.alert('Could Not Resend', friendlyAuthError(error));
    } else {
      setResentConfirmation(true);
      setResendCooldown(30);
    }
  }, [resending, resendCooldown, email]);

  // --- OAuth signup (Google, Twitter, LinkedIn, Microsoft) ---
  const handleOAuthSignup = useCallback(async (provider: OAuthProvider) => {
    const names: Record<string, string> = { google: 'Google', twitter: 'X (Twitter)', linkedin_oidc: 'LinkedIn', azure: 'Microsoft' };
    const name = names[provider] ?? provider;
    setLoading(true);
    setOAuthProvider(provider);
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
      setOAuthProvider(null);
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
        setOAuthProvider(null);
        return;
      }
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (sessionError) {
        Alert.alert('Sign In Failed', friendlyAuthError(sessionError));
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
    setOAuthProvider(null);
  }, [track, appleAvailable]);

const handleAppleSignup = useCallback(async () => {
    try {
      setLoading(true);
      setOAuthProvider('apple');
      await signInWithApple();
      track('signup_apple_success');
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
        <MailCheck size={48} color={colors.primary} strokeWidth={1.5} style={{ marginBottom: 16 }} />
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
          accessibilityRole="button"
          accessibilityLabel="Back to login"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Back to Login</Text>
        </TouchableOpacity>

        {resentConfirmation && resendCooldown > 0 ? (
          <Text style={{ fontSize: 14, color: colors.success, fontWeight: '500', marginBottom: 4 }}>
            Verification email sent
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleResendVerification}
          disabled={resending || resendCooldown > 0}
          accessibilityRole="button"
          accessibilityLabel="Resend verification email"
          accessibilityState={{ disabled: resending || resendCooldown > 0, busy: resending }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {resending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: resendCooldown > 0 ? colors.textSecondary : colors.primary,
              }}
            >
              {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend email'}
            </Text>
          )}
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
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
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
                  onPress={() => handleOAuthSignup('twitter')}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with X"
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
                  onPress={() => handleOAuthSignup('linkedin_oidc')}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with LinkedIn"
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
                  onPress={() => handleOAuthSignup('azure')}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Microsoft"
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
                  onPress={handleAppleSignup}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Apple"
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
              placeholder="Password (min 8 characters)"
              value={password}
              onChangeText={handlePasswordChange}
              textContentType="newPassword"
              autoComplete="new-password"
              accessibilityLabel="Password"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              blurOnSubmit={false}
            />
            <View>
              <PasswordInput
                ref={confirmPasswordRef}
                style={passwordError ? { borderColor: colors.error } : undefined}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                textContentType="newPassword"
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
              accessibilityRole="button"
              accessibilityLabel="Create account"
              accessibilityState={{ disabled: loading || !!passwordError, busy: loading }}
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
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go to login">
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
