/**
 * GAS Template, Reset Password (request) Screen
 *
 * Step 1 of the password-recovery flow: the user enters their email and we ask
 * Supabase to send a recovery link. The link's `redirectTo` points at the same
 * deep-link callback the OAuth flow uses (`{scheme}://auth/callback`); the
 * callback detects `type=recovery` and forwards to the update-password screen.
 *
 * On success we swap the form for a "Check your email" confirmation (mirrors the
 * signup verification-sent screen) rather than bouncing the user away, so a
 * mistyped address is obvious and a resend is one tap.
 *
 * All colors come from useThemeColors(), never hardcoded.
 * Uses SafeAreaView from 'react-native-safe-area-context' (CRITICAL).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { makeRedirectUri } from 'expo-auth-session';
import { MailCheck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/useAnalytics';
import { addBreadcrumb } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { useThemeColors } from '@/context/ThemeContext';
import { friendlyAuthError } from '@/lib/auth-errors';
import { gasConfig } from '../../gas.config';

// --- Config-driven values ---
const SCHEME = gasConfig.app.scheme;
const APP_NAME = gasConfig.app.name;

export default function ResetPasswordScreen() {
  const { track } = useAnalytics();
  const { colors } = useThemeColors();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Capture mount-time once so re-renders don't reset the screen-load baseline.
  const screenStartRef = useRef(Date.now());
  useEffect(() => {
    track('reset_password_screen_viewed');
    trackScreenLoad('reset_password', screenStartRef.current);
  }, [track]);

  const handleSendResetLink = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    track('reset_password_requested');
    // Mirror how login/signup build redirectTo so the recovery link lands on the
    // shared deep-link callback, which forwards `type=recovery` to update-password.
    const redirectTo = makeRedirectUri({ scheme: SCHEME, path: 'auth/callback' });
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
    setLoading(false);
    if (error) {
      track('reset_password_failed', { error: error.message });
      addBreadcrumb('auth', 'Password reset request failed');
      Alert.alert('Reset Failed', friendlyAuthError(error));
      return;
    }
    // Always show the confirmation on success. (Supabase intentionally does not
    // reveal whether an address exists; we mirror that and never disclose it.)
    setSent(true);
  }, [email, track]);

  // --- Shared input style (matches login/signup) ---
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

  // --- Confirmation ("Check your email") state ---
  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: colors.background }}>
        <MailCheck size={48} color={colors.primary} strokeWidth={1.5} style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
          Check your email
        </Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 8, lineHeight: 22 }}>
          If an account exists for{' '}
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{email.trim()}</Text>, we sent a link to reset your password.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
          Tap the link in the email to choose a new password. Check your spam folder if you don't see it within a few minutes.
        </Text>
        <TouchableOpacity
          style={{
            height: 48, width: '100%', borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}
          onPress={() => router.replace('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Back to sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSendResetLink}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Resend reset link"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500' }}>Resend email</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Request form ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo header */}
          <View style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 32, gap: 16 }}>
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
                Reset password
              </Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 }}>
                Enter your email and we'll send you a link to choose a new password.
              </Text>
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
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
              returnKeyType="send"
              onSubmitEditing={handleSendResetLink}
            />
            <TouchableOpacity
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: email.trim() ? colors.primary : colors.primary + '66', // 40% opacity when empty
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={handleSendResetLink}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Send reset link"
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Send reset link</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Back to sign in */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Remember your password?</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to sign in">
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Back to sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
