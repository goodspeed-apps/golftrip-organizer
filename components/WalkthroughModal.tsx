/**
 * GAS Template, WalkthroughModal
 *
 * Step-by-step guided walkthrough with progress dots and navigation.
 * Used by HowToUseModal to show detailed instructions per workflow.
 *
 * Features:
 * - Data-driven steps via props (icon, title, description)
 * - Progress dots showing current position
 * - Forward/back navigation buttons
 * - Persists "completed" state to AsyncStorage per walkthrough
 * - Large centered icon illustration per step
 * - Optional tab/location badge per step
 * - Theme-aware: the step card and its text read live tokens from
 *   ThemeContext (useThemeColors); the immersive backdrop stays dark by design
 * - Analytics: tracks step views, completion, and skip events
 * - Sentry breadcrumb on walkthrough start
 * - Accessibility labels on all navigation controls
 *
 * Extracted from ThreadLift's WalkthroughModal, made generic and data-driven.
 *
 * Dependencies: gasConfig, lib/posthog, lib/sentry, @react-native-async-storage/async-storage
 */

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureEvent } from '@/lib/posthog';
import { addBreadcrumb } from '@/lib/sentry';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalkthroughStep {
  /** Lucide icon component for this step */
  icon: React.ElementType;
  /** Icon accent color */
  iconColor: string;
  /** Step title */
  title: string;
  /** Detailed instruction text */
  description: string;
  /** Optional badge label (e.g., tab name: "Dashboard", "Settings") */
  badge?: string;
}

interface WalkthroughModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the walkthrough should close */
  onClose: () => void;
  /** Walkthrough title (shown in header) */
  title: string;
  /** Theme color for progress dots, buttons, badges */
  color: string;
  /** Array of steps to walk through */
  steps: WalkthroughStep[];
  /** Optional: unique ID for persistence (defaults to title slug) */
  persistenceKey?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * WalkthroughModal, Step-by-step guided walkthrough with progress dots.
 *
 * Usage:
 *   <WalkthroughModal
 *     visible={showWalkthrough}
 *     onClose={() => setShowWalkthrough(false)}
 *     title="Find Viral Content"
 *     color="#FF4500"
 *     steps={[
 *       { icon: TrendingUp, iconColor: '#FF4500', title: 'Open Feed', description: 'Tap the...' },
 *       { icon: BarChart2, iconColor: '#FF4500', title: 'Read Scores', description: 'Each item...' },
 *     ]}
 *   />
 */
export function WalkthroughModal({
  visible,
  onClose,
  title,
  color,
  steps,
  persistenceKey,
}: WalkthroughModalProps) {
  const { colors } = useThemeColors();
  const [currentStep, setCurrentStep] = useState(0);

  // Track walkthrough start
  useEffect(() => {
    if (visible) {
      captureEvent('walkthrough_started', { title, totalSteps: steps.length });
      addBreadcrumb('ui', `Walkthrough started: ${title}`);
      setCurrentStep(0); // Reset on open
    }
  }, [visible, title, steps.length]);

  if (!steps.length) return null;

  const step = steps[currentStep];
  if (!step) return null;

  const totalSteps = steps.length;
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;
  const Icon = step.icon;

  const handleClose = () => {
    if (!isLast) {
      captureEvent('walkthrough_skipped', { title, at_step: currentStep, total: totalSteps });
    }
    setCurrentStep(0);
    onClose();
  };

  const handleNext = async () => {
    if (isLast) {
      captureEvent('walkthrough_completed', { title, totalSteps });

      // Persist completion
      const key = `@${gasConfig.app.slug}:walkthrough:${persistenceKey ?? title.toLowerCase().replace(/\s+/g, '_')}`;
      try {
        await AsyncStorage.setItem(key, 'completed');
      } catch {
        // Ignore persistence errors
      }

      setCurrentStep(0);
      onClose();
    } else {
      const nextStep = currentStep + 1;
      captureEvent('walkthrough_step', { title, step: nextStep, total: totalSteps });
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: 64,
        }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>
            {title.toUpperCase()}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            style={{ padding: 4, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel="Close walkthrough"
            accessibilityRole="button"
          >
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Icon illustration */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 128,
            height: 128,
            borderRadius: 64,
            backgroundColor: step.iconColor + '18',
            borderWidth: 1,
            borderColor: step.iconColor + '30',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon size={56} color={step.iconColor} />
          </View>

          {/* Optional badge (e.g., tab name) */}
          {step.badge && (
            <View style={{
              marginTop: 24,
              backgroundColor: color + '18',
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: color + '35',
            }}>
              <Text style={{ color, fontSize: 13, fontWeight: '600' }}>
                {step.badge}
              </Text>
            </View>
          )}
        </View>

        {/* Step card */}
        <View style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: 28,
          paddingBottom: 52,
        }}>
          {/* Progress dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 24 }}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === currentStep ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === currentStep ? color : colors.border,
                  marginHorizontal: 3,
                }}
                accessibilityLabel={`Step ${i + 1} of ${totalSteps}${i === currentStep ? ', current' : ''}`}
              />
            ))}
          </View>

          {/* Step content */}
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 10 }}>
            {step.title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24, marginBottom: 28 }}>
            {step.description}
          </Text>

          {/* Navigation buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {!isFirst && (
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: 'center',
                }}
                onPress={handleBack}
                accessibilityLabel="Previous step"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>← Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: color,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
              }}
              onPress={handleNext}
              accessibilityLabel={isLast ? 'Finish walkthrough' : 'Next step'}
              accessibilityRole="button"
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                {isLast ? 'Got it ✓' : 'Next →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
