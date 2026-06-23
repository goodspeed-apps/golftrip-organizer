/**
 * GAS Template — BiometricLockScreen
 *
 * Full-screen themed blocking overlay shown when the app has been locked after
 * a background timeout (see AuthProvider's background-timeout listener, which
 * sets biometricLocked=true). Renders OVER the entire app — the app content is
 * not navigable until the user re-authenticates.
 *
 * The only way to dismiss it is a successful biometric unlock: the "Unlock"
 * button calls unlockBiometric() (Face ID / Touch ID / device passcode via
 * expo-local-authentication, wired through useAuth). A failed/cancelled attempt
 * leaves the lock in place.
 *
 * Dependencies: hooks/useAuth, context/ThemeContext, lucide-react-native, gas.config
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Fingerprint } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';

export function BiometricLockScreen() {
  const { unlockBiometric } = useAuth();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [unlocking, setUnlocking] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleUnlock = useCallback(async () => {
    if (unlocking) return;
    setUnlocking(true);
    setFailed(false);
    try {
      const ok = await unlockBiometric();
      // On success AuthProvider flips biometricLocked=false and this screen
      // unmounts; on failure we stay locked and surface a retry hint.
      if (!ok) setFailed(true);
    } finally {
      setUnlocking(false);
    }
  }, [unlockBiometric, unlocking]);

  // Auto-prompt once on mount so the user isn't forced to tap before the OS
  // sheet appears — matches platform lock-screen expectations.
  useEffect(() => {
    void handleUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Lock size={40} color={colors.primary} accessible={false} />
        </View>

        <Text style={[styles.appName, { color: colors.text }]} accessibilityRole="header">
          {gasConfig.app.name}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {failed
            ? 'Authentication failed. Try again to continue.'
            : 'Locked for your security. Unlock to continue.'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleUnlock}
        disabled={unlocking}
        accessibilityRole="button"
        accessibilityLabel={`Unlock ${gasConfig.app.name}`}
        accessibilityState={{ disabled: unlocking, busy: unlocking }}
        style={[
          styles.button,
          { backgroundColor: colors.primary, opacity: unlocking ? 0.7 : 1 },
        ]}
      >
        {unlocking ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Fingerprint size={20} color="#FFFFFF" accessible={false} />
            <Text style={styles.buttonText}>Unlock</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

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
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
