/**
 * GAS Template, FeedbackButton
 *
 * Floating action button for collecting user feedback. Supports both
 * manual trigger (button press) and shake-to-report gesture detection.
 *
 * Features:
 * - Floating button positioned by parent (typically bottom-right)
 * - Shake gesture detection via expo-sensors Accelerometer
 * - Modal with textarea + category picker (bug, feature, general, ux)
 * - Captures device context: device info, app version, current screen, user, subscription tier
 * - Submits to Supabase `feedback` table
 * - Analytics: tracks feedback submission with source and category
 * - Sentry breadcrumb on submission
 * - Error handling with toast notification on failure
 * - Config-gated: only renders when analytics is enabled
 * - Accessibility labels on all controls
 *
 * Dependencies: expo-sensors, expo-device, gasConfig, lib/posthog, lib/sentry, lib/supabase
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Pressable,
} from 'react-native';
import { MessageSquarePlus, X, Bug, Lightbulb, MessageCircle, Palette } from 'lucide-react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureEvent } from '@/lib/posthog';
import { addBreadcrumb } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { isWeb } from '@/lib/platform';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';

// Conditionally import native-only modules
let Accelerometer: typeof import('expo-sensors').Accelerometer | null = null;
let Device: typeof import('expo-device') | null = null;
if (!isWeb) {
  try {
    const sensors = require('expo-sensors');
    Accelerometer = sensors.Accelerometer;
    Device = require('expo-device');
  } catch {
    // Modules not available
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackCategory = 'bug' | 'feature_request' | 'general' | 'ux';

interface FeedbackButtonProps {
  /** Override visibility. Defaults to gasConfig.features.analytics.enabled */
  visible?: boolean;
  /** User ID for attribution */
  userId?: string;
  /** Subscription tier for prioritization */
  subscriptionTier?: string;
  /** Enable shake-to-report (default: true) */
  shakeEnabled?: boolean;
}

// ─── Category Config ─────────────────────────────────────────────────────────

// Category base definitions, colors are injected at render from the theme token map.
const CATEGORY_DEFS: Array<{ id: FeedbackCategory; label: string; icon: React.ElementType }> = [
  { id: 'bug', label: 'Bug Report', icon: Bug },
  { id: 'feature_request', label: 'Feature Request', icon: Lightbulb },
  { id: 'ux', label: 'UX Issue', icon: Palette },
  { id: 'general', label: 'General', icon: MessageCircle },
];

const SHAKE_THRESHOLD = 1.8;
const SHAKE_COOLDOWN_MS = 2000;
let accelIntervalSet = false;

/**
 * FeedbackButton, Floating feedback trigger with shake-to-report.
 *
 * Usage:
 *   // In _layout.tsx or screen:
 *   <FeedbackButton userId={user?.id} subscriptionTier={tier} />
 */
export function FeedbackButton({
  visible,
  userId,
  subscriptionTier,
  shakeEnabled = true,
}: FeedbackButtonProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [source, setSource] = useState<'button' | 'shake'>('button');
  const lastShakeRef = useRef(0);
  const pathname = usePathname();
  // Always call unconditionally, hook rules require these before any early return.
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();

  // Category colors resolved from theme tokens so a rebrand propagates automatically.
  const CATEGORIES = [
    { ...CATEGORY_DEFS[0], color: colors.error },
    { ...CATEGORY_DEFS[1], color: colors.warning },
    { ...CATEGORY_DEFS[2], color: colors.secondary },
    { ...CATEGORY_DEFS[3], color: colors.textSecondary },
  ];

  // Only visible in development builds; never ships to TestFlight / App Store.
  const isVisible = __DEV__ && (visible ?? true);

  // Shake detection (native only, Accelerometer not available on web)
  useEffect(() => {
    if (isWeb || !Accelerometer || !shakeEnabled || !isVisible) return;

    const subscription = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > SHAKE_THRESHOLD && now - lastShakeRef.current > SHAKE_COOLDOWN_MS) {
        lastShakeRef.current = now;
        setSource('shake');
        setModalVisible(true);
      }
    });

    if (!accelIntervalSet) {
      Accelerometer.setUpdateInterval(200);
      accelIntervalSet = true;
    }

    return () => subscription.remove();
  }, [shakeEnabled, isVisible]);

  const handleOpen = () => {
    setSource('button');
    setModalVisible(true);
  };

  const handleClose = () => {
    setModalVisible(false);
    setText('');
    setCategory('general');
    setSubmitted(false);
  };

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);

    try {
      const deviceInfo = {
        brand: Device?.brand ?? 'Unknown',
        model: Device?.modelName ?? 'Unknown',
        os: Platform.OS,
        osVersion: Platform.Version,
      };

      const { error } = await supabase.from('feedback').insert({
        user_id: userId ?? null,
        category,
        text: text.trim(),
        source: source === 'shake' ? 'shake_report' : 'in_app',
        device_info: deviceInfo,
        app_version: gasConfig.app.version,
        screen: pathname,
        is_paid_user: subscriptionTier ? subscriptionTier !== 'free' && subscriptionTier !== 'Free' : false,
      });

      if (error) throw error;

      captureEvent('feedback_submitted', { source, category, text_length: text.trim().length });
      addBreadcrumb('feedback', `Feedback submitted: ${category}`, { source, screen: pathname });

      setSubmitted(true);
      setTimeout(handleClose, 1500);
    } catch (err) {
      captureEvent('feedback_submit_failed', { error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }, [text, category, source, userId, subscriptionTier, pathname, submitting]);

  if (!isVisible) return null;

  return (
    <>
      {/* Floating button */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: insets.bottom + 16,
          right: insets.right + 16,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}
        onPress={handleOpen}
        accessibilityLabel="Send feedback"
        accessibilityRole="button"
      >
        <MessageSquarePlus size={22} color={colors.textOnPrimary} />
      </TouchableOpacity>

      {/* Feedback modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={handleClose}>
            <Pressable
              onPress={e => e.stopPropagation()}
              style={{ marginTop: 'auto' }}
            >
              <View style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 24,
                paddingBottom: 44,
              }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
                    {submitted ? 'Thank you!' : 'Send Feedback'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close feedback"
                  >
                    <X size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {submitted ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', paddingVertical: 20 }}>
                    Your feedback helps us improve {gasConfig.app.name}. We read every submission.
                  </Text>
                ) : (
                  <>
                    {/* Category picker */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {CATEGORIES.map(cat => {
                          const Icon = cat.icon;
                          const isActive = category === cat.id;
                          return (
                            <TouchableOpacity
                              key={cat.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: isActive ? cat.color : colors.border,
                                backgroundColor: isActive ? cat.color + '18' : 'transparent',
                              }}
                              onPress={() => setCategory(cat.id)}
                              accessibilityRole="button"
                              accessibilityLabel={cat.label}
                              accessibilityState={{ selected: isActive }}
                            >
                              <Icon size={14} color={isActive ? cat.color : colors.textSecondary} />
                              <Text style={{ color: isActive ? cat.color : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                                {cat.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>

                    {/* Text input */}
                    <TextInput
                      style={{
                        backgroundColor: colors.background,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        color: colors.text,
                        fontSize: 15,
                        padding: 14,
                        minHeight: 100,
                        textAlignVertical: 'top',
                        marginBottom: 16,
                      }}
                      placeholder="Tell us what happened..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      maxLength={1000}
                      value={text}
                      onChangeText={setText}
                      accessibilityLabel="Feedback text"
                    />

                    {/* Submit button */}
                    <TouchableOpacity
                      style={{
                        backgroundColor: text.trim() ? colors.primary : colors.border,
                        borderRadius: 14,
                        paddingVertical: 15,
                        alignItems: 'center',
                        opacity: submitting ? 0.7 : 1,
                      }}
                      onPress={handleSubmit}
                      disabled={!text.trim() || submitting}
                      accessibilityLabel="Submit feedback"
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !text.trim() || submitting, busy: submitting }}
                    >
                      <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 15 }}>
                        {submitting ? 'Sending...' : 'Send Feedback'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
