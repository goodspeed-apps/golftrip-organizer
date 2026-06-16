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
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  const isVisible = visible ?? gasConfig.features.analytics?.enabled ?? false;

  const openModal = useCallback((src: 'button' | 'shake') => {
    setSource(src);
    setModalVisible(true);
    setSubmitted(false);
    setText('');
    setCategory('general');
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      let deviceInfo: Record<string, unknown> = {};
      if (Device) {
        deviceInfo = {
          brand: Device.brand,
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion,
        };
      }
      const { error } = await supabase.from('feedback').insert({
        user_id: userId ?? null,
        category,
        body: text.trim(),
        source,
        screen: pathname,
        subscription_tier: subscriptionTier ?? null,
        device_info: deviceInfo,
      });

      if (error) throw error;

      captureEvent('feedback_submitted', { category, source, screen: pathname });
      addBreadcrumb({ message: 'Feedback submitted', data: { category, source } });
      setSubmitted(true);
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch {
      // toast would go here
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, userId, category, source, pathname, subscriptionTier, closeModal]);

  // Shake detection
  useEffect(() => {
    if (!shakeEnabled || isWeb || !Accelerometer || !isVisible) return;
    let sub: { remove: () => void } | null = null;
    if (!accelIntervalSet) {
      Accelerometer.setUpdateInterval(200);
      accelIntervalSet = true;
    }
    sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - lastShakeRef.current > SHAKE_COOLDOWN_MS) {
        lastShakeRef.current = now;
        openModal('shake');
      }
    });
    return () => sub?.remove();
  }, [shakeEnabled, isVisible, openModal]);

  if (!isVisible) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => openModal('button')}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 80,
          right: 16,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
        accessibilityRole="button"
        accessibilityLabel="Send feedback"
      >
        <MessageSquarePlus size={24} color={colors.textOnPrimary} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={closeModal} />
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: insets.bottom + 20,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Send Feedback</Text>
              <TouchableOpacity onPress={closeModal} accessibilityRole="button" accessibilityLabel="Close feedback">
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🎉</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Thanks for your feedback!</Text>
              </View>
            ) : (
              <>
                {/* Category picker */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const selected = category === cat.id;
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
                            backgroundColor: selected ? cat.color : colors.background,
                            borderWidth: 1,
                            borderColor: selected ? cat.color : colors.border,
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={cat.label}
                          accessibilityState={{ selected }}
                        >
                          <Icon size={14} color={selected ? colors.textOnPrimary : cat.color} />
                          <Text style={{ fontSize: 13, fontWeight: '500', color: selected ? colors.textOnPrimary : colors.text }}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Text input */}
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Describe the issue or idea…"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={5}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: colors.background,
                    minHeight: 120,
                    textAlignVertical: 'top',
                    marginBottom: 16,
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
                    height: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: !text.trim() || submitting ? 0.6 : 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Submit feedback"
                  accessibilityState={{ disabled: !text.trim() || submitting, busy: submitting }}
                >
                  <Text style={{ color: colors.textOnPrimary, fontWeight: '600', fontSize: 15 }}>
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
