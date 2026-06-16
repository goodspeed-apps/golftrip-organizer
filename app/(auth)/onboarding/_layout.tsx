/**
 * GAS Template, Onboarding Stack Layout
 *
 * Stack navigator for onboarding screens with slide-from-right animation.
 * The DevAgent adds more screens (goals, preferences, etc.) based on the app.
 * gasConfig.features.onboarding.steps defines which screens exist.
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
