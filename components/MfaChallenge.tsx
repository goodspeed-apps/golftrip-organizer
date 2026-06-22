/**
 * GAS Template, MfaChallenge
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
        // No factor resolvable, surface an error rather than soft-locking.
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
          // Session is now AAL2, re-check so AuthProvider drops the gate.
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

  const styles = StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 300,
      marginBottom: 32,
    },
    codeInput: {
      width: '100%',
      height: 56,
      borderRadius: 14,
      borderWidth: 1.5,
      textAlign: 'center',
      fontSize: 28,
      letterSpacing: 10,
      marginBottom: 16,
    },
    errorText: {
      fontSize: 14,
      marginBottom: 12,
      textAlign: 'center',
    },
    verifyButton: {
      width: '100%',
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    verifyButtonText: {
      color: colors.textOnPrimary,
      fontSize: 17,
      fontWeight: '600',
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 12,
    },
    signOutText: {
      fontSize: 15,
    },
  });

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
          Enter the 6-digit code from your authenticator app.
        </Text>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          placeholder="------"
          placeholderTextColor={colors.placeholder}
          style={[
            styles.codeInput,
            {
              backgroundColor: colors.surface,
              borderColor: error ? colors.error : colors.border,
              color: colors.text,
            },
          ]}
          accessibilityLabel="One-time password"
          autoFocus
        />

        {error && (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={() => void handleVerify(code)}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Verify code"
        accessibilityState={{ disabled: !canSubmit, busy: verifying }}
        style={[
          styles.verifyButton,
          { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.5 },
        ]}
      >
        {verifying ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.verifyButtonText}>Verify</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => void signOut()}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={styles.signOutButton}
      >
        <LogOut size={16} color={colors.textSecondary} accessible={false} />
        <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}
