/**
 * GAS Template, Onboarding Welcome Screen
 *
 * First onboarding step. Shows the app logo, name, and description from gasConfig.
 * "Get Started" CTA navigates to the next onboarding step (or signup if only one step).
 *
 * This is a placeholder, DevAgent adds more onboarding steps based on the app.
 * The step dots and navigation adapt to gasConfig.features.onboarding.steps.
 *
 * All colors come from useThemeColors(), never hardcoded.
 * Uses SafeAreaView from 'react-native-safe-area-context' (CRITICAL).
 */

import { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useThemeColors } from '@/context/ThemeContext';
import { markOnboardingComplete } from '@/lib/onboarding-buffer';
import { gasConfig } from '../../../gas.config';

const ONBOARDING_STEPS = gasConfig.features.onboarding.steps;
const APP_NAME = gasConfig.app.name;
const APP_DESCRIPTION = gasConfig.app.description;

/**
 * Step progress dots, shows current position in the onboarding flow.
 */
function StepDots({ step, total }: { step: number; total: number }) {
  const { colors } = useThemeColors();

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      accessibilityLabel={`Step ${step} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 8,
            width: i + 1 === step ? 24 : 8,
            borderRadius: 4,
            backgroundColor: i + 1 <= step ? colors.primary : colors.border,
            opacity: i + 1 <= step ? 1 : 0.35,
          }}
        />
      ))}
    </View>
  );
}

export default function OnboardingWelcome() {
  const router = useRouter();
  const { track } = useAnalytics();
  const { colors } = useThemeColors();

  useEffect(() => {
    track('screen_view', { screen: 'onboarding_welcome' });
  }, []);

  /**
   * Navigate to the next onboarding step, or to signup if this is the only step.
   * Steps are defined in gasConfig.features.onboarding.steps.
   */
  async function handleGetStarted() {
    if (ONBOARDING_STEPS.length > 1) {
      // Navigate to the second step (first step is 'welcome', which is this screen).
      const nextStep = ONBOARDING_STEPS[1];
      router.push(`/(auth)/onboarding/${nextStep}` as any);
    } else {
      // Welcome is the only onboarding screen, so mark onboarding complete here
      // before going to signup. Without this the has_onboarded flag is never set,
      // and a logged-out returning user is routed back through onboarding on every
      // cold start. A DevAgent-added multi-step flow must mark complete on its
      // final step instead.
      await markOnboardingComplete();
      router.push('/(auth)/signup');
    }
  }

  // Total steps includes welcome + subsequent steps + signup (as the final destination).
  // For dot display, we show one dot per onboarding screen.
  const totalDots = ONBOARDING_STEPS.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, justifyContent: 'space-between' }}>
        {/* Step dots */}
        <StepDots step={1} total={totalDots} />

        {/* Center content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 }}>
          {/* AppLogo placeholder, DevAgent replaces with app-specific logo */}
          <View style={{
            width: 96, height: 96, borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 48, fontWeight: '800', color: '#FFFFFF' }}>
              {APP_NAME.charAt(0)}
            </Text>
          </View>

          <View style={{ alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 38, fontWeight: '800', color: colors.text, letterSpacing: -1, textAlign: 'center' }}>
              {APP_NAME}
            </Text>
            <Text style={{
              fontSize: 16, color: colors.textSecondary,
              textAlign: 'center', lineHeight: 24, maxWidth: 280,
            }}>
              {APP_DESCRIPTION}
            </Text>
          </View>
        </View>

        {/* CTA button */}
        <TouchableOpacity
          style={{
            width: '100%',
            backgroundColor: colors.primary,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            minHeight: 54,
          }}
          onPress={handleGetStarted}
          accessibilityLabel="Get started"
        >
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
