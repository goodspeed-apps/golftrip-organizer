/**
 * GAS Template — MfaChallenge
 *
 * Full-screen themed blocking gate shown when the user has an enrolled MFA
 * factor but the current session is only at AAL1 (see AuthProvider's checkMFA,
 * which sets mfaRequired=true when currentLevel !== nextLevel). The app content
 * is not reachable until the user enters a valid 6-digit TOTP code and the
 * session is elevated to AAL2.
 *
 * Flow:
 * - listMFAFactors() → pick the verified TOTP factor.
 * - verifyMFA(factorId, code) wraps supabase.auth.mfa.challenge + verify, which
 *   on success elevates the session to AAL2.
 * - recheckMFA() re-reads the assurance level so AuthProvider clears the gate
 *   and this screen unmounts.
 *
 * Dependencies: hooks/useAuth, lib/mfa, context/ThemeContext, lucide-react-native
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck, LogOut } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/context/ThemeContext';
import { listMFAFactors, verifyMFA } from '@/lib/mfa';

const CODE_LENGTH = 6;

export function MfaChallenge() {
  const { recheckMFA, signOut } = useAuth();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the verified TOTP factor to challenge against.
  useEffect(() => {
    let active = true;
    (async () => {
      const factors = await listMFAFactors();
      if (!active) return;
      const verified = factors.find(f => f.status === 'verified') ?? factors[0];
      if (verified) {
        setFactorId(verified.id);
      } else {
        // No factor resolvable — surface an error rather than soft-locking.
        setError('Unable to load your authenticator. Sign out and try again.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleVerify = useCallback(
    async (submitted: string) => {
      if (verifying || !factorId || submitted.length !== CODE_LENGTH) return;
      Keyboard.dismiss();
      setVerifying(true);
      setError(null);
      try {
        const ok = await verifyMFA(factorId, submitted);
        if (ok) {
          // Session is now AAL2 — re-check so AuthProvider drops the gate.
          await recheckMFA();
        } else {
          setError('That code was incorrect. Try again.');
          setCode('');
        }
      } finally {
        setVerifying(false);
      }
    },
    [verifying, factorId, recheckMFA],
  );

  const handleChange = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
      setCode(digits);
      if (error) setError(null);
      if (digits.length === CODE_LENGTH) {
        void handleVerify(digits);
      }
    },
    [error, handleVerify],
  );

  const canSubmit = code.length === CODE_LENGTH && !verifying && !!factorId;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.content}>
        <View
          style={[styles.iconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessible={false}
        >
          <ShieldCheck size={40} color={colors.primary} accessible={false} />
        </View>

        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Two-factor authentication
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter the 6-digit code from your authenticator app to continue.
        </Text>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          autoFocus
          editable={!verifying}
          accessibilityLabel="6-digit authentication code"
          placeholder="000000"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: error ? colors.error : colors.border,
            },
          ]}
        />

        {error ? (
          <Text style={[styles.error, { color: colors.error }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={() => handleVerify(code)}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Verify code"
          accessibilityState={{ disabled: !canSubmit, busy: verifying }}
          style={[
            styles.button,
            { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.6 },
          ]}
        >
          {verifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => void signOut()}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={styles.signOut}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <LogOut size={16} color={colors.textSecondary} accessible={false} />
        <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: 28,
  },
  input: {
    width: '100%',
    maxWidth: 280,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 8,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 280,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
