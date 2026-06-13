/**
 * GAS Template, Auth Stack Layout
 *
 * Stack navigator for authentication screens with fade animation and no header.
 * Contains login, signup, and onboarding routes.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
