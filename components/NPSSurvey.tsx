/**
 * GAS Template, NPSSurvey (Net Promoter Score)
 *
 * Modal survey for collecting NPS scores (0-10) with optional follow-up text.
 * Includes smart trigger logic to show at the right time.
 *
 * Features:
 * - 0-10 button scale with color-coded segments (detractor/passive/promoter)
 * - Optional follow-up textarea for qualitative feedback
 * - Smart trigger: configurable session threshold, 90-day cooldown
 * - Score categorization: 0-6 detractor, 7-8 passive, 9-10 promoter
 * - Submits to Supabase `feedback` table with type: 'nps'
 * - Persists last-shown timestamp to AsyncStorage
 * - Analytics: tracks display, submission, dismissal
 * - Sentry breadcrumb on submission
 * - Loading state on submit, success confirmation
 * - Accessibility labels on all controls
 *
 * Dependencies: gasConfig, lib/posthog, lib/sentry, lib/supabase
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, Pressable } from 'react-native';
import { X, ThumbsUp } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureEvent } from '@/lib/posthog';
import { addBreadcrumb } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { gasConfig } from '../gas.config';
import { useThemeColors } from '@/context/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NPSSurveyProps {
  /** Whether the survey modal is visible (controlled mode) */
  visible?: boolean;
  /** Called when the survey should close */
  onClose?: () => void;
  /** User ID for attribution */
  userId?: string;
  /** Whether user is on a paid plan */
  isPaidUser?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = `@${gasConfig.app.slug}:nps_last_shown`;
const SESSION_KEY = `@${gasConfig.app.slug}:nps_session_count`;
const ONBOARDING_KEY = `@${gasConfig.app.slug}:has_onboarded`;
const COOLDOWN_DAYS = 90;
const DEFAULT_SESSION_THRESHOLD = 7;
const primary = gasConfig.design.colors.primary;
const surfaceDark = gasConfig.design.colors.surfaceDark;
const borderDark = gasConfig.design.colors.borderDark;

// ─── Smart Trigger Hook ──────────────────────────────────────────────────────

/**
 * useNPSSurvey, Hook that manages NPS survey trigger logic.
 *
 * Tracks session count and determines when to show the survey.
 * Call in _layout.tsx to auto-trigger based on session count.
 *
 * @param sessionThreshold - Number of sessions before showing (default: 7)
 * @returns { shouldShow, dismiss } - Whether to show + dismiss callback
 *
 * Usage:
 *   const { shouldShow, dismiss } = useNPSSurvey(7);
 *   {shouldShow && <NPSSurvey visible onClose={dismiss} userId={user?.id} />}
 */
export function useNPSSurvey(sessionThreshold = DEFAULT_SESSION_THRESHOLD) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    checkTrigger();
  }, []);

  const checkTrigger = async () => {
    try {
      const hasOnboardedRaw = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (hasOnboardedRaw !== 'true') return;

      const rawCount = await AsyncStorage.getItem(SESSION_KEY);
      const count = (parseInt(rawCount ?? '0', 10) || 0) + 1;
      await AsyncStorage.setItem(SESSION_KEY, String(count));

      if (count < sessionThreshold) return;

      const lastShown = await AsyncStorage.getItem(STORAGE_KEY);
      if (lastShown) {
        const daysSince = (Date.now() - new Date(lastShown).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < COOLDOWN_DAYS) return;
      }

      setShouldShow(true);
    } catch {
      // swallow
    }
  };

  const dismiss = useCallback(async () => {
    setShouldShow(false);
    await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    await AsyncStorage.setItem(SESSION_KEY, '0');
  }, []);

  return { shouldShow, dismiss };
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * NPSSurvey, Net Promoter Score modal survey.
 *
 * Usage (controlled):
 *   <NPSSurvey visible={show} onClose={() => setShow(false)} userId={user.id} />
 *
 * Usage (auto-trigger):
 *   const { shouldShow, dismiss } = useNPSSurvey(7);
 *   <NPSSurvey visible={shouldShow} onClose={dismiss} userId={user.id} />
 */
export function NPSSurvey({ visible = false, onClose, userId, isPaidUser }: NPSSurveyProps) {
  const { colors } = useThemeColors();
  const [score, setScore] = useState<number | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      captureEvent('nps_displayed');
      addBreadcrumb('ui', 'NPSSurvey displayed');
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (!submitted) {
      captureEvent('nps_dismissed', { score });
    }
    onClose?.();
    setTimeout(() => {
      setScore(null);
      setFollowUp('');
      setSubmitted(false);
    }, 300);
  }, [submitted, score, onClose]);

  const handleSubmit = useCallback(async () => {
    if (score === null) return;
    setSubmitting(true);
    try {
      const category = score <= 6 ? 'detractor' : score <= 8 ? 'passive' : 'promoter';
      const { error } = await supabase.from('feedback').insert({
        user_id: userId,
        type: 'nps',
        score,
        category,
        body: followUp.trim() || null,
        is_paid_user: isPaidUser ?? false,
      });
      if (error) throw error;

      captureEvent('nps_submitted', { score, category });
      addBreadcrumb('feedback', `NPS submitted: ${score} (${category})`);
      setSubmitted(true);
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
      await AsyncStorage.setItem(SESSION_KEY, '0');
      setTimeout(handleClose, 2000);
    } catch {
      // toast would go here
    } finally {
      setSubmitting(false);
    }
  }, [score, followUp, userId, isPaidUser, handleClose]);

  const getScoreColor = (n: number) => {
    if (n <= 6) return '#EF4444';
    if (n <= 8) return '#F59E0B';
    return '#10B981';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
        onPress={handleClose}
      >
        <Pressable
          style={{
            backgroundColor: surfaceDark,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
          onPress={() => {}}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.textOnPrimary, fontSize: 18, fontWeight: '700' }}>
              {submitted ? 'Thanks for your feedback!' : 'How likely are you to recommend us?'}
            </Text>
            <TouchableOpacity onPress={handleClose} accessibilityLabel="Close survey">
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ThumbsUp size={48} color={colors.success} />
              <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
                Your feedback helps us improve!
              </Text>
            </View>
          ) : (
            <>
              {/* Score buttons */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {Array.from({ length: 11 }, (_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setScore(i)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: score === i ? getScoreColor(i) : borderDark,
                    }}
                    accessibilityLabel={`Score ${i}`}
                  >
                    <Text style={{ color: score === i ? colors.textOnPrimary : colors.textSecondary, fontWeight: '600' }}>
                      {i}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Labels */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>Not likely</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>Very likely</Text>
              </View>

              {/* Follow-up */}
              {score !== null && (
                <TextInput
                  value={followUp}
                  onChangeText={setFollowUp}
                  placeholder="Tell us more (optional)…"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: borderDark,
                    borderRadius: 10,
                    padding: 12,
                    color: colors.textOnPrimary,
                    minHeight: 80,
                    textAlignVertical: 'top',
                    marginBottom: 16,
                  }}
                />
              )}

              {/* Submit */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={score === null || submitting}
                style={{
                  backgroundColor: primary,
                  borderRadius: 10,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: score === null || submitting ? 0.5 : 1,
                }}
                accessibilityLabel="Submit NPS score"
              >
                <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 15 }}>
                  {submitting ? 'Submitting…' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
