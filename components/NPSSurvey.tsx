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
      // Don't even count this as a session if the user is still in onboarding.
      const hasOnboardedRaw = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (hasOnboardedRaw !== 'true') return;

      // Increment session count (counted only post-onboarding)
      const rawCount = await AsyncStorage.getItem(SESSION_KEY);
      const count = (parseInt(rawCount ?? '0', 10) || 0) + 1;
      await AsyncStorage.setItem(SESSION_KEY, String(count));

      // Check threshold
      if (count < sessionThreshold) return;

      // Check cooldown
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
 *   <NPSSurvey visible={show} onClose={() => setShow(false)} userId={user?.id} />
 *
 * Usage (auto-trigger):
 *   const { shouldShow, dismiss } = useNPSSurvey(7);
 *   <NPSSurvey visible={shouldShow} onClose={dismiss} userId={user?.id} />
 */
export function NPSSurvey({ visible = false, onClose, userId, isPaidUser }: NPSSurveyProps) {
  const { colors } = useThemeColors();
  const [score, setScore] = useState<number | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      captureEvent('nps_survey_displayed');
      addBreadcrumb('ui', 'NPS survey displayed');
    }
  }, [visible]);

  const getScoreColor = (n: number) => {
    if (n <= 6) return '#EF4444';
    if (n <= 8) return '#F59E0B';
    return '#10B981';
  };

  const handleSubmit = async () => {
    if (score === null) return;
    setSubmitting(true);
    try {
      const category = score <= 6 ? 'detractor' : score <= 8 ? 'passive' : 'promoter';
      await supabase.from('feedback').insert({
        user_id: userId,
        type: 'nps',
        score,
        category,
        body: followUp.trim() || null,
        is_paid_user: isPaidUser,
      });
      captureEvent('nps_submitted', { score, category });
      addBreadcrumb('user', 'NPS submitted', { score, category });
      setSubmitted(true);
    } catch {
      // swallow
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitted) {
      captureEvent('nps_dismissed', { score_selected: score });
    }
    setScore(null);
    setFollowUp('');
    setSubmitted(false);
    onClose?.();
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
        >
          {/* Close button */}
          <TouchableOpacity
            onPress={handleClose}
            style={{ position: 'absolute', top: 16, right: 16, padding: 8 }}
            accessibilityLabel="Dismiss survey"
          >
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {submitted ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ThumbsUp size={48} color={colors.success} style={{ marginBottom: 16 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
                Thanks for your feedback!
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center' }}>
                Your response helps us improve {gasConfig.app.name}.
              </Text>
            </View>
          ) : (
            <>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 4, marginTop: 8 }}>
                How likely are you to recommend {gasConfig.app.name}?
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>
                0 = Not at all · 10 = Extremely likely
              </Text>

              {/* Score buttons */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {Array.from({ length: 11 }, (_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setScore(i)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: score === i ? getScoreColor(i) : borderDark,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityLabel={`Score ${i}`}
                  >
                    <Text style={{ color: score === i ? '#FFFFFF' : colors.textSecondary, fontWeight: '600' }}>
                      {i}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {score !== null && (
                <>
                  <TextInput
                    value={followUp}
                    onChangeText={setFollowUp}
                    placeholder="Tell us more (optional)..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    numberOfLines={3}
                    style={{
                      backgroundColor: borderDark,
                      borderRadius: 12,
                      padding: 14,
                      color: '#FFFFFF',
                      fontSize: 14,
                      minHeight: 80,
                      textAlignVertical: 'top',
                      marginBottom: 16,
                    }}
                    accessibilityLabel="Follow-up feedback"
                  />
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={{
                      backgroundColor: primary,
                      borderRadius: 12,
                      padding: 16,
                      alignItems: 'center',
                      opacity: submitting ? 0.7 : 1,
                    }}
                    accessibilityLabel="Submit NPS score"
                  >
                    <Text style={{ color: colors.success, fontSize: 16, fontWeight: '600' }}>
                      {submitting ? 'Submitting...' : 'Submit'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
