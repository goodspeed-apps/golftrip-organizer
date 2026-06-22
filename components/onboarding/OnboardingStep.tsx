import { ReactNode } from 'react';
import { View } from 'react-native';
import { useOnboarding } from './OnboardingProvider';

export function OnboardingStep({ index, children }: { index: number; children: ReactNode }) {
  const { current } = useOnboarding();
  if (current !== index) return null;
  return <View style={{ flex: 1 }}>{children}</View>;
}
