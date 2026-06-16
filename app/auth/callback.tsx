/**
 * GAS Template, OAuth Deep Link Callback
 *
 * Handles the OAuth redirect from providers (Google, Apple, Twitter, etc.).
 * Reads the deep link scheme from gasConfig.app.scheme.
 *
 * Flow:
 * 1. Provider redirects to {scheme}://auth/callback?code=...&state=...
 * 2. Verify `state` against the value stored in secure store when the flow
 *    was initiated. Reject the callback on mismatch.
 * 3. On match, exchange the code for a Supabase session.
 * 4. On success -> navigate to first tab
 * 5. On error -> navigate to login
 *
 * Password recovery: the reset-password email link redirects here with
 * `type=recovery`. Recovery links are NOT OAuth and carry no `state`, so they
 * are handled first, before the OAuth state check. We forward the recovery
 * `code` to the update-password screen WITHOUT exchanging it here: the root
 * layout redirects any authenticated user out of (auth) into the tabs, so
 * deferring the exchange to the moment the user submits a new password keeps
 * them on the form instead of bouncing them into the app.
 *
 * TODO(DevAgent): `gasConfig.app.scheme` MUST be unique per generated app.
 * If two installed apps share the same scheme, the OS may route this deep
 * link to either app, which is how the spoof vector starts. The state-param
 * check below makes the spoof unexploitable (the hostile app can't satisfy
 * a state it didn't see), but DevAgent should still enforce uniqueness at
 * generation time as defense-in-depth.
 */

import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/context/ThemeContext';
import { verifyAndClearOAuthState } from '@/lib/crypto';
import { gasConfig } from '../../gas.config';

// Complete any pending auth sessions in the browser.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const { code, state, type, error_code, error_description } = useLocalSearchParams<{
    code?: string;
    state?: string;
    type?: string;
    error_code?: string;
    error_description?: string;
  }>();
  const router = useRouter();
  const { colors } = useThemeColors();

  // Determine the first tab route from config.
  const firstTab = gasConfig.navigation.tabs[0]?.file ?? 'index';

  useEffect(() => {
    async function handleCallback() {
      // Handle error from provider
      if (error_code) {
        console.error('Auth callback error:', error_code, error_description);
        // Drop any stored state, this flow is finished.
        await verifyAndClearOAuthState(null);
        router.replace('/(auth)/login');
        return;
      }

      if (!code) {
        await verifyAndClearOAuthState(null);
        router.replace('/(auth)/login');
        return;
      }

      // Password recovery branch. Recovery links arrive with `type=recovery`
      // and no OAuth `state`, so they must be handled before the state check
      // below. Forward the recovery code to update-password and let that screen
      // exchange it on submit (see the file header for why we defer the
      // exchange). Drop any stored OAuth state since this is not an OAuth flow.
      if (type === 'recovery') {
        await verifyAndClearOAuthState(null);
        router.replace({ pathname: '/(auth)/update-password', params: { code } });
        return;
      }

      // Validate the `state` parameter against the value stored when the
      // OAuth flow was initiated. `verifyAndClearOAuthState` clears the
      // stored value on every call (match or not) so a leaked code cannot
      // be replayed against a stale state.
      const stateOk = await verifyAndClearOAuthState(state);
      if (!stateOk) {
        console.error('Auth callback rejected: OAuth state mismatch');
        router.replace('/(auth)/login');
        return;
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Exchange error:', error.message);
          router.replace('/(auth)/login');
        } else {
          router.replace(`/(tabs)/${firstTab}` as any);
        }
      } catch (e) {
        console.error('Callback exception:', e);
        router.replace('/(auth)/login');
      }
    }

    handleCallback();
  }, [code, state, type, error_code, error_description, firstTab, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 16 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ fontSize: 15, color: colors.textSecondary }}>Verifying your account...</Text>
    </View>
  );
}
