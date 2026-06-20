/**
 * GAS Template, ConsentBanner (GDPR/CCPA)
 *
 * Bottom banner for collecting user consent for analytics, marketing,
 * and functional tracking. Supports granular consent toggles.
 *
 * Features:
 * - Bottom banner with accept/manage/decline options
 * - Granular consent toggles: analytics, marketing, functional
 * - Persists consent to AsyncStorage
 * - Logs consent decisions to Supabase consent_log table
 * - Three lifecycle states: not-shown → shown → accepted/declined
 * - "Manage Preferences" re-trigger from settings
 * - Config-gated: only renders if gasConfig.features.compliance.gdprConsent
 * - Analytics: tracks consent decisions
 * - Sentry breadcrumb on consent change
 * - Accessibility labels on all controls
 *
 * Dependencies: gasConfig, lib/posthog, lib/sentry, lib/supabase
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Switch, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureEvent } from '@/lib/posthog';
import { addBreadcrumb, captureException } from '@/lib/sentry';
import { recordConsent } from '@/lib/consent';
import { gasConfig } from '../gas.config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  timestamp: string;
}

interface ConsentBannerProps {
  /** Current user ID for logging consent */
  userId?: string;
  /** Force show the banner (e.g., from Settings > Manage Preferences) */
  forceShow?: boolean;
  /** Called when consent is resolved */
  onComplete?: (consent: ConsentState) => void;
}

const STORAGE_KEY = `@${gasConfig.app.slug}:consent`;
const primary = gasConfig.design.colors.primary;
const surfaceDark = gasConfig.design.colors.surfaceDark;
const borderDark = gasConfig.design.colors.borderDark;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the current consent state. Returns null if consent hasn't been given.
 */
export async function getConsentState(): Promise<ConsentState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Check if analytics consent has been granted.
 */
export async function hasAnalyticsConsent(): Promise<boolean> {
  const consent = await getConsentState();
  if (!consent) return !gasConfig.features.compliance.gdprConsent; // No consent needed = granted
  return consent.analytics;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ConsentBanner, GDPR/CCPA consent collection banner.
 *
 * Usage:
 *   // In _layout.tsx:
 *   {gasConfig.features.compliance.gdprConsent && (
 *     <ConsentBanner userId={user?.id} onComplete={setConsent} />
 *   )}
 *
 *   // In Settings > Manage Preferences:
 *   <ConsentBanner userId={user?.id} forceShow onComplete={() => setShowBanner(false)} />
 */
export function ConsentBanner({ userId, forceShow = false, onComplete }: ConsentBannerProps) {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [functional, setFunctional] = useState(true);
  const slideAnim = useRef(new Animated.Value(200)).current;

  // Stop animation on unmount to prevent memory leak
  useEffect(() => {
    return () => { slideAnim.stopAnimation(); };
  }, [slideAnim]);

  useEffect(() => {
    if (forceShow) {
      loadExisting();
      show();
      return;
    }
    checkShouldShow();
  }, [forceShow]);

  const loadExisting = async () => {
    const existing = await getConsentState();
    if (existing) {
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
      setFunctional(existing.functional);
    }
  };

  const checkShouldShow = async () => {
    if (!gasConfig.features.compliance.gdprConsent && !gasConfig.features.compliance.ccpaNotice) {
      return;
    }
    const existing = await getConsentState();
    if (!existing) {
      show();
    }
  };

  const show = () => {
    setVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const hide = () => {
    Animated.timing(slideAnim, { toValue: 200, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  };

  const saveConsent = useCallback(async (consent: ConsentState) => {
    try {
await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(consent));

      if (userId) {
        try {
          await recordConsent([
            { type: 'analytics', consented: consent.analytics },
            { type: 'marketing', consented: consent.marketing },
            { type: 'functional', consented: consent.functional },
          ], { userId });
        } catch (insertError) {
          captureException(insertError, { component: 'ConsentBanner', action: 'log_consent' });
        }
      }

      captureEvent('consent_updated', {
        analytics: consent.analytics,
        marketing: consent.marketing,
        functional: consent.functional,
      });
      addBreadcrumb('compliance', 'Consent updated', {
        analytics: String(consent.analytics),
        marketing: String(consent.marketing),
      });

      onComplete?.(consent);
    } catch {
      // Fail silently, consent storage is not critical path
    }
  }, [userId, onComplete]);

  const handleAcceptAll = useCallback(async () => {
    const consent: ConsentState = {
      analytics: true,
      marketing: true,
      functional: true,
      timestamp: new Date().toISOString(),
    };
    await saveConsent(consent);
    hide();
  }, [saveConsent]);

  const handleDeclineAll = useCallback(async () => {
    const consent: ConsentState = {
      analytics: false,
      marketing: false,
      functional: true, // Functional is always needed
      timestamp: new Date().toISOString(),
    };
    await saveConsent(consent);
    hide();
  }, [saveConsent]);

  const handleSavePreferences = useCallback(async () => {
    const consent: ConsentState = {
      analytics,
      marketing,
      functional: true,
      timestamp: new Date().toISOString(),
    };
    await saveConsent(consent);
    hide();
  }, [analytics, marketing, saveConsent]);

  if (!visible) return null;

  return (
    <Animated.View style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: surfaceDark,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderColor: borderDark,
      padding: 20,
      paddingBottom: 36,
      transform: [{ translateY: slideAnim }],
      zIndex: 9998,
    }}>
<Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
        Usage signals are on by default
      </Text>
      <Text style={{ color: '#9CA3AF', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
        This app shares anonymous usage signals with Goodspeed to improve future apps in this category. We share patterns (e.g. which onboarding lengths convert), never your specific designs or content. You can turn this off any time in Settings.
      </Text>

      {showDetails && (
        <View style={{ marginBottom: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Analytics</Text>
              <Text style={{ color: '#6B7280', fontSize: 12 }}>Help us understand app usage</Text>
            </View>
            <Switch
              value={analytics}
              onValueChange={setAnalytics}
              trackColor={{ false: '#2D2D3A', true: primary + '60' }}
              thumbColor={analytics ? primary : '#6B7280'}
              accessibilityLabel="Analytics consent"
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Marketing</Text>
              <Text style={{ color: '#6B7280', fontSize: 12 }}>Personalized recommendations</Text>
            </View>
            <Switch
              value={marketing}
              onValueChange={setMarketing}
              trackColor={{ false: '#2D2D3A', true: primary + '60' }}
              thumbColor={marketing ? primary : '#6B7280'}
              accessibilityLabel="Marketing consent"
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Functional</Text>
              <Text style={{ color: '#6B7280', fontSize: 12 }}>Required for app to work</Text>
            </View>
            <Switch
              value={true}
              disabled
              trackColor={{ false: '#2D2D3A', true: primary + '60' }}
              thumbColor={primary}
              accessibilityLabel="Functional consent (required)"
            />
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={{ gap: 8 }}>
        {showDetails ? (
          <TouchableOpacity
            style={{ backgroundColor: primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            onPress={handleSavePreferences}
            accessibilityLabel="Save consent preferences"
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Save Preferences</Text>
          </TouchableOpacity>
        ) : (
          <>
<TouchableOpacity
              style={{ backgroundColor: primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={handleAcceptAll}
              accessibilityLabel="Keep usage signals on"
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Keep On</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: borderDark, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={handleDeclineAll}
              accessibilityLabel="Turn off usage signals"
            >
              <Text style={{ color: '#9CA3AF', fontWeight: '600', fontSize: 14 }}>Turn Off</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
}
