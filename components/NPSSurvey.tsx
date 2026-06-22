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
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';

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
      // The whole point of NPS is "would you recommend this app?", that question
      // is incoherent until the user has actually used the app at least once.
      // Without this gate, the modal can auto-pop over onboarding screen 1 of N.
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
      // Fail silently
    }
  };

  const dismiss = useCallback(async () => {
    setShouldShow(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Fail silently
    }
  }, []);

  return { shouldShow, dismiss };
}

// ─── Score Helpers ────────────────────────────────────────────────────────────

function getScoreCategory(score: number): 'detractor' | 'passive' | 'promoter' {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
}

function getScoreColor(score: number, colors: { error: string; warning: string; success: string }): string {
  const cat = getScoreCategory(score);
  if (cat === 'detractor') return colors.error;
  if (cat === 'passive') return colors.warning;
  return colors.success;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * NPSSurvey, NPS score collection modal.
 *
 * Can be used in controlled mode (visible + onClose props)
 * or with the useNPSSurvey hook for auto-triggering.
 *
 * Usage:
 *   // Controlled mode:
 *   <NPSSurvey visible={showNPS} onClose={() => setShowNPS(false)} userId={user?.id} />
 *
 *   // Auto-trigger mode (in _layout.tsx):
 *   const { shouldShow, dismiss } = useNPSSurvey(7);
 *   {shouldShow && <NPSSurvey visible onClose={dismiss} userId={user?.id} />}
 */
export function NPSSurvey({ visible = false, onClose, userId, isPaidUser = false }: NPSSurveyProps) {
  const { colors } = useThemeColors();
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (visible) {
      captureEvent('nps_displayed');
      addBreadcrumb('engagement', 'NPS survey displayed');
    }
  }, [visible]);

  const handleDismiss = useCallback(async () => {
    captureEvent('nps_dismissed', {
      had_score: selectedScore !== null,
    });
    setSelectedScore(null);
    setComment('');
    setSubmitted(false);
    onClose?.();
  }, [selectedScore, onClose]);

  const handleSubmit = useCallback(async () => {
    if (selectedScore === null || submitting) return;
    setSubmitting(true);

    const category = getScoreCategory(selectedScore);

    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: userId ?? null,
        category: 'general',
        text: comment.trim() || `NPS Score: ${selectedScore}/10`,
        source: 'nps',
        nps_score: selectedScore,
        is_paid_user: isPaidUser,
      });

      if (error) throw error;

      captureEvent('nps_submitted', {
        score: selectedScore,
        category,
        hasComment: !!comment.trim(),
      });
      addBreadcrumb('engagement', `NPS submitted: ${selectedScore} (${category})`);

      // Save cooldown
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());

      setSubmitted(true);
      dismissTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, 2000);
    } catch (err) {
      captureEvent('nps_submit_failed', { error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }, [selectedScore, comment, userId, isPaidUser, submitting, handleDismiss]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}
        onPress={handleDismiss}
      >
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 24,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
                {submitted ? 'Thank you!' : 'Quick Question'}
              </Text>
              <TouchableOpacity
                onPress={handleDismiss}
                style={{ padding: 4, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                accessibilityLabel="Close survey"
                accessibilityRole="button"
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ThumbsUp size={40} color={colors.success} accessible={false} />
                <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
                  Your feedback helps us make {gasConfig.app.name} better!
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 20 }}>
                  How likely are you to recommend {gasConfig.app.name} to a friend?
                </Text>

                {/* Score buttons (0-10) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  {Array.from({ length: 11 }, (_, i) => {
                    const isSelected = selectedScore === i;
                    const scoreColor = getScoreColor(i, colors);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={{
                          width: 28,
                          height: 36,
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isSelected ? scoreColor : colors.background,
                          borderWidth: 1,
                          borderColor: isSelected ? scoreColor : colors.border,
                        }}
                        onPress={() => setSelectedScore(i)}
                        accessibilityLabel={`Score ${i}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={{
                          color: isSelected ? '#FFFFFF' : colors.text,
                          fontSize: 13,
                          fontWeight: isSelected ? '700' : '500',
                        }}>
                          {i}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Scale labels */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Not likely</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Very likely</Text>
                </View>

                {/* Follow-up textarea (shown after score selection) */}
                {selectedScore !== null && (
                  <TextInput
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      color: colors.text,
                      fontSize: 14,
                      padding: 12,
                      minHeight: 60,
                      textAlignVertical: 'top',
                      marginBottom: 16,
                    }}
                    placeholder={
                      getScoreCategory(selectedScore) === 'detractor'
                        ? "What could we do better?"
                        : "What do you like most?"
                    }
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    maxLength={500}
                    value={comment}
                    onChangeText={setComment}
                    accessibilityLabel="Additional feedback"
                  />
                )}

                {/* Submit button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: selectedScore !== null ? colors.primary : colors.border,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center',
                    opacity: submitting ? 0.7 : 1,
                  }}
                  onPress={handleSubmit}
                  disabled={selectedScore === null || submitting}
                  accessibilityLabel="Submit NPS score"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: selectedScore === null || submitting, busy: submitting }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                    {submitting ? 'Sending...' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
