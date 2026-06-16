import { View, Pressable, Text } from 'react-native';
import { useOnboarding } from './OnboardingProvider';

export function OnboardingControls() {
  const { current, total, next, prev, skip, complete } = useOnboarding();
  const isLast = current === total - 1;
  const leftLabel = current === 0 ? 'Skip' : 'Back';
  const rightLabel = isLast ? 'Get started' : 'Next';
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
      <Pressable
        onPress={current === 0 ? skip : prev}
        accessibilityRole="button"
        accessibilityLabel={leftLabel}
        style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center' }}
      >
        <Text>{leftLabel}</Text>
      </Pressable>
      <Pressable
        onPress={isLast ? complete : next}
        accessibilityRole="button"
        accessibilityLabel={rightLabel}
        style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'flex-end' }}
      >
        <Text>{rightLabel}</Text>
      </Pressable>
    </View>
  );
}
