import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

interface OnboardingProgressProps {
  /** 1-indexed current step. Accepts `current` or `currentStep`. */
  current?: number;
  currentStep?: number;
  /** Total step count. Accepts `total` or `totalSteps`. */
  total?: number;
  totalSteps?: number;
}

export function OnboardingProgress({ current, currentStep, total, totalSteps }: OnboardingProgressProps) {
  const { colors } = useThemeColors();
  // Call sites in onboarding/welcome / learner-background / placement-quiz
  // currently pass `current` and `total`, but the original interface declared
  // `currentStep` and `totalSteps`. Accept both shapes to avoid silently
  // rendering an empty progress bar (Array.from({length: undefined}) = []).
  const resolvedCurrent = current ?? currentStep ?? 1;
  const resolvedTotal = total ?? totalSteps ?? 1;

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={styles.container}
      accessibilityLabel={`Step ${resolvedCurrent} of ${resolvedTotal}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: resolvedTotal, now: resolvedCurrent }}
    >
      {Array.from({ length: resolvedTotal }, (_, i) => (
        <StepDot
          key={i}
          isActive={i + 1 === resolvedCurrent}
          isCompleted={i + 1 < resolvedCurrent}
          colors={colors}
        />
      ))}
    </Animated.View>
  );
}

interface StepDotProps {
  isActive: boolean;
  isCompleted: boolean;
  colors: ReturnType<typeof useThemeColors>['colors'];
}

function StepDot({ isActive, isCompleted, colors }: StepDotProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  React.useEffect(() => {
    if (isActive) {
      scale.value = withSpring(1.2, { damping: 15 });
    } else {
      scale.value = withSpring(1, { damping: 15 });
    }
  }, [isActive]);

  const backgroundColor = isCompleted
    ? colors.primary
    : isActive
    ? colors.primary
    : colors.border;

  const width = isActive ? 24 : 8;

  return (
    <Animated.View
      style={[
        styles.dot,
        animatedStyle,
        {
          backgroundColor,
          width,
          opacity: isCompleted ? 0.6 : 1,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
