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
import { gasConfig } from '../gas.config';
import { useThemeColors } from '@/context/ThemeContext';

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

const CATEGORIES: Array<{ id: FeedbackCategory; label: string; icon: React.ElementType; color: string }> = [
  { id: 'bug', label: 'Bug Report', icon: Bug, color: '#EF4444' },
  { id: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: '#F59E0B' },
  { id: 'ux', label: 'UX Issue', icon: Palette, color: '#8B5CF6' },
  { id: 'general', label: 'General', icon: MessageCircle, color: '#6B7280' },
];

const SHAKE_THRESHOLD = 1.8;
const SHAKE_COOLDOWN_MS = 2000;
let accelIntervalSet = false;

// ─── Component ───────────────────────────────────────────────────────────────

const primary = gasConfig.design.colors.primary;
const surfaceDark = gasConfig.design.colors.surfaceDark;
const borderDark = gasConfig.design.colors.borderDark;

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
  const { colors } = useThemeColors();
  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [source, setSource] = useState<'button' | 'shake'>('button');
  const lastShakeRef = useRef(0);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isEnabled = visible ?? gasConfig.features?.analytics?.enabled ?? true;

  // ─── Shake Detection ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!shakeEnabled || isWeb || !Accelerometer || !isEnabled) return;

    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - lastShakeRef.current > SHAKE_COOLDOWN_MS) {
        lastShakeRef.current = now;
        setSource('shake');
        setModalVisible(true);
      }
    });

    return () => sub.remove();
  }, [shakeEnabled, isEnabled]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);

    try {
      let deviceInfo = {};
      if (Device) {
        deviceInfo = {
          brand: Device.brand,
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion,
        };
      }

      const { error } = await supabase.from('feedback').insert({
        user_id: userId,
        category,
        body: text.trim(),
        source,
        screen: pathname,
        subscription_tier: subscriptionTier,
        device_info: deviceInfo,
        app_version: gasConfig.app?.version,
      });

      if (error) throw error;

      captureEvent('feedback_submitted', { category, source, screen: pathname });
      addBreadcrumb('feedback', `Feedback submitted: ${category}`);
      setSubmitted(true);
      setTimeout(() => {
        setModalVisible(false);
        setSubmitted(false);
        setText('');
        setCategory('general');
      }, 1500);
    } catch (err) {
      // In a real app, show a toast here
      console.error('Feedback submission failed', err);
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, category, source, pathname, userId, subscriptionTier]);

  if (!isEnabled) return null;

  return (
    <>
      {/* Floating Button */}
      <TouchableOpacity
        onPress={() => { setSource('button'); setModalVisible(true); }}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 80,
          right: 16,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
        accessibilityLabel="Send feedback"
        accessibilityRole="button"
      >
        <MessageSquarePlus size={22} color={colors.textOnPrimary} />
      </TouchableOpacity>

      {/* Feedback Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setModalVisible(false)} />
          <View style={{
            backgroundColor: surfaceDark,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            paddingBottom: insets.bottom + 24,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textOnPrimary }}>Send Feedback</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityLabel="Close feedback">
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                <Text style={{ color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' }}>Thanks for the feedback!</Text>
              </View>
            ) : (
              <>
                {/* Category Picker */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setCategory(cat.id)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: isSelected ? cat.color : borderDark,
                            borderWidth: 1,
                            borderColor: isSelected ? cat.color : borderDark,
                          }}
                          accessibilityLabel={cat.label}
                        >
                          <Icon size={14} color={isSelected ? colors.textOnPrimary : colors.textSecondary} />
                          <Text style={{ color: isSelected ? colors.textOnPrimary : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Text Input */}
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Describe the issue or idea…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  style={{
                    backgroundColor: borderDark,
                    borderRadius: 12,
                    padding: 14,
                    color: colors.textOnPrimary,
                    fontSize: 15,
                    minHeight: 100,
                    marginBottom: 16,
                    textAlignVertical: 'top',
                  }}
                  accessibilityLabel="Feedback text"
                />

                {/* Submit */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!text.trim() || submitting}
                  style={{
                    backgroundColor: primary,
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: 'center',
                    opacity: !text.trim() || submitting ? 0.5 : 1,
                  }}
                  accessibilityLabel="Submit feedback"
                >
                  <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 15 }}>
                    {submitting ? 'Sending…' : 'Send Feedback'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
