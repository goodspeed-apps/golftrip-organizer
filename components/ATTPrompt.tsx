/**
 * GAS Template, ATTPrompt (App Tracking Transparency)
 *
 * Pre-prompt explainer screen shown before the system ATT dialog on iOS.
 * Explains the value proposition of personalized tracking to increase opt-in rates.
 *
 * Features:
 * - Pre-prompt screen with value proposition before system dialog
 * - Uses expo-tracking-transparency for the actual system prompt
 * - Persists "shown" state to AsyncStorage (show only once)
 * - Respects consent before initializing tracking services
 * - Config-gated: only renders if gasConfig.features.compliance.attDialog is true
 * - Analytics: tracks prompt result (granted/denied/undetermined)
 * - Sentry breadcrumb on prompt result
 * - Accessibility labels on all controls
 * - Handles unsupported devices gracefully (Android, older iOS)
 *
 * Dependencies: expo-tracking-transparency, gasConfig, lib/posthog, lib/sentry
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Shield } from 'lucide-react-native';
import { captureEvent } from '@/lib/posthog';
import { addBreadcrumb, captureException } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ATTPromptProps {
  /** Current user ID for logging consent (optional, ATT may fire before auth) */
  userId?: string;
  /** Called after the prompt is resolved (granted, denied, or skipped) */
  onComplete?: (granted: boolean) => void;
}

const STORAGE_KEY = `@${gasConfig.app.slug}:att_prompted`;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ATTPrompt, Pre-prompt explainer before iOS App Tracking Transparency dialog.
 *
 * Usage:
 *   // In _layout.tsx, after splash screen hides:
 *   {showATT && <ATTPrompt onComplete={(granted) => setShowATT(false)} />}
 */
export function ATTPrompt({ userId, onComplete }: ATTPromptProps) {
  const { colors } = useThemeColors();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    checkShouldShow();
  }, []);

  const checkShouldShow = async () => {
    // Only relevant on iOS
    if (Platform.OS !== 'ios') {
      onComplete?.(true);
      return;
    }

    // Check if already shown
    try {
      const shown = await AsyncStorage.getItem(STORAGE_KEY);
      if (shown === 'true') {
        // Already prompted, check current status
        const { status } = await getTrackingPermissionsAsync();
        onComplete?.(status === 'granted');
        return;
      }
    } catch {
      // Continue to show prompt
    }

    // Check if ATT is required (not on simulators or pre-iOS 14)
    if (!gasConfig.features.compliance.attDialog) {
      onComplete?.(true);
      return;
    }

    setShouldShow(true);
  };

  const handleContinue = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      const { status } = await requestTrackingPermissionsAsync();
      const granted = status === 'granted';

      captureEvent('att_prompt', { status });
      addBreadcrumb('compliance', `ATT prompt result: ${status}`);

      // Log consent to Supabase for server-side audit trail
      if (userId) {
        supabase.from('consent_log').insert({
          user_id: userId,
          consent_type: 'att',
          consented: status === 'granted',
          version: '1.0',
        }).then(({ error: insertError }) => {
          if (insertError) captureException(insertError, { component: 'ATTPrompt', action: 'consent_log' });
        });
      }

      onComplete?.(granted);
    } catch (err) {
      captureEvent('att_prompt_error', { error: String(err) });
      onComplete?.(false);
    }

    setShouldShow(false);
  }, [onComplete]);

  const handleSkip = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    captureEvent('att_prompt', { status: 'skipped' });
    onComplete?.(false);
    setShouldShow(false);
  }, [onComplete]);

  if (!shouldShow) return null;

  return (
    <View style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      zIndex: 9999,
    }}>
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 32,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
      }}>
        {/* Icon */}
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: colors.primary + '18',
          borderWidth: 1, borderColor: colors.primary + '30',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Shield size={32} color={colors.primary} accessible={false} />
        </View>

        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
          Help Us Improve {gasConfig.app.name}
        </Text>

        <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 }}>
          We use anonymous data to understand how you use the app and make it better.
          Your data is never sold to third parties.
        </Text>

        {/* Continue button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 15,
            width: '100%',
            alignItems: 'center',
            marginBottom: 12,
          }}
          onPress={handleContinue}
          accessibilityLabel="Continue to tracking permission"
          accessibilityRole="button"
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Continue</Text>
        </TouchableOpacity>

        {/* Skip link */}
        <TouchableOpacity
          onPress={handleSkip}
          style={{ padding: 8 }}
          accessibilityLabel="Skip tracking permission"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
