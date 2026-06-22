/**
 * GAS Template, Update Password Screen
 *
 * Step 2 of the password-recovery flow: the screen the recovery deep link lands
 * on (the callback forwards here with the recovery `code` after detecting
 * `type=recovery`). The user enters a new password twice; on submit we exchange
 * the recovery code for a short-lived session and immediately set the new
 * password, then route into the app.
 *
 * Why exchange here instead of in the callback: the root layout redirects any
 * authenticated user out of the (auth) group into the tabs. By deferring the
 * code exchange to the moment of submit, the user has NO session while filling
 * out the form (so they are never bounced away), and the session that the
 * exchange creates is immediately followed by the redirect-to-app on success, 
 * which is exactly where we want them to land.
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
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/useAnalytics';
import { addBreadcrumb } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { useThemeColors } from '@/context/ThemeContext';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { friendlyAuthError } from '@/lib/auth-errors';
import { gasConfig } from '../../gas.config';

const APP_NAME = gasConfig.app.name;
const MIN_PASSWORD_LENGTH = 8;

export default function UpdatePasswordScreen() {
  const { track } = useAnalytics();
  const { colors } = useThemeColors();
  // The recovery `code` is forwarded by the callback; some Supabase setups send
  // the user straight here with the code in the URL, so read it directly too.
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const confirmRef = useRef<TextInput>(null);

  // The first authenticated route once the password is set.
  const firstTab = gasConfig.navigation.tabs[0]?.file ?? 'index';

  // Capture mount-time once so re-renders don't reset the screen-load baseline.
  const screenStartRef = useRef(Date.now());
  useEffect(() => {
    track('update_password_screen_viewed');
    trackScreenLoad('update_password', screenStartRef.current);
  }, [track]);

  const handleConfirmChange = useCallback((val: string) => {
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

  const handleUpdatePassword = useCallback(async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Weak Password', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setLoading(true);
    track('update_password_attempted');

    // If we arrived with a recovery code and don't yet have a session, exchange
    // it now. `updateUser` requires an authenticated session, and the exchange
    // sets it on the client before resolving. If there's already a recovery
    // session (e.g. PASSWORD_RECOVERY established it), this is skipped.
    if (code) {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setLoading(false);
          track('update_password_failed', { error: exchangeError.message });
          addBreadcrumb('auth', 'Recovery code exchange failed');
          Alert.alert(
            'Link Expired',
            'This reset link is invalid or has expired. Please request a new one.',
          );
          return;
        }
      }
    }

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      track('update_password_failed', { error: error.message });
      addBreadcrumb('auth', 'Password update failed');
      // Supabase rejects reusing the current password with a specific message;
      // surface it directly since it's actionable and safe.
      const reused = error.message.toLowerCase().includes('should be different');
      Alert.alert(
        'Update Failed',
        reused ? 'Your new password must be different from your old password.' : friendlyAuthError(error),
      );
      return;
    }

    track('update_password_succeeded');
    Alert.alert('Password Updated', 'Your password has been changed.');
    // Session is now active, head into the app.
    router.replace(`/(tabs)/${firstTab}` as any);
  }, [password, confirmPassword, code, firstTab, track]);

  const canSubmit = password.length >= MIN_PASSWORD_LENGTH && confirmPassword.length > 0 && !passwordError;

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
                Choose a new password
              </Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 }}>
                Enter a new password for your account.
              </Text>
            </View>
          </View>

          {/* Password form */}
          <View style={{ gap: 12, marginBottom: 24 }}>
            <PasswordInput
              placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
              value={password}
              onChangeText={handlePasswordChange}
              textContentType="newPassword"
              autoComplete="new-password"
              accessibilityLabel="New password"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              blurOnSubmit={false}
            />
            <View>
              <PasswordInput
                ref={confirmRef}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={handleConfirmChange}
                textContentType="newPassword"
                autoComplete="new-password"
                accessibilityLabel="Confirm new password"
                returnKeyType="done"
                onSubmitEditing={handleUpdatePassword}
                style={passwordError ? { borderColor: colors.error } : undefined}
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
                backgroundColor: canSubmit ? colors.primary : colors.primary + '66', // 40% opacity when disabled
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={handleUpdatePassword}
              disabled={loading || !canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Update password"
              accessibilityState={{ disabled: loading || !canSubmit, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Update password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
