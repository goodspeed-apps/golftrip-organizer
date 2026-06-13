import { View, Pressable, Text } from 'react-native';
import { useOnboarding } from './OnboardingProvider';

export function OnboardingControls() {
  const { current, total, next, prev, skip, complete } = useOnboarding();
  const isLast = current === total - 1;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
      <Pressable onPress={current === 0 ? skip : prev}>
        <Text>{current === 0 ? 'Skip' : 'Back'}</Text>
      </Pressable>
      <Pressable onPress={isLast ? complete : next}>
        <Text>{isLast ? 'Get started' : 'Next'}</Text>
      </Pressable>
    </View>
  );
}
