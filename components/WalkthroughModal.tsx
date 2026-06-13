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
 * - Theme-aware colors from gasConfig
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
import { gasConfig } from '../gas.config';
import { useThemeColors } from '@/context/ThemeContext';

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

const surfaceDarkColor = gasConfig.design.colors.surfaceDark;

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
  const [currentStep, setCurrentStep] = useState(0);
  const { colors } = useThemeColors();

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
        await AsyncStorage.setItem(key, 'true');
      } catch {
        // swallow
      }
      handleClose();
    } else {
      captureEvent('walkthrough_step_viewed', { title, step: currentStep + 1, total: totalSteps });
      setCurrentStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) setCurrentStep(s => s - 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: surfaceDarkColor, borderRadius: 20, padding: 28, width: '100%', maxWidth: 400 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
            <TouchableOpacity onPress={handleClose} accessibilityLabel="Close walkthrough">
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={40} color={step.iconColor} />
            </View>
            {step.badge && (
              <View style={{ marginTop: 10, backgroundColor: color + '33', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{step.badge}</Text>
              </View>
            )}
          </View>

          {/* Step content */}
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>{step.title}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 }}>{step.description}</Text>

          {/* Progress dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === currentStep ? 18 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === currentStep ? color : colors.border,
                }}
              />
            ))}
          </View>

          {/* Navigation */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {!isFirst && (
              <TouchableOpacity
                onPress={handleBack}
                accessibilityLabel="Previous step"
                style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleNext}
              accessibilityLabel={isLast ? 'Finish walkthrough' : 'Next step'}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.textOnPrimary, fontWeight: '700' }}>{isLast ? 'Done' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
