import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ChevronLeft, DollarSign, Utensils, Car, Hotel } from 'lucide-react-native';

const EXPENSE_TYPES = [
  { id: 'green_fees', label: 'Green Fees', icon: DollarSign, example: '$150/player' },
  { id: 'accommodation', label: 'Accommodation', icon: Hotel, example: '$200/night' },
  { id: 'food_drink', label: 'Food & Drinks', icon: Utensils, example: 'Split the tab' },
  { id: 'transport', label: 'Transport', icon: Car, example: 'Gas, rentals' },
];

export default function Step5Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();
  const [selected, setSelected] = useState<string>('green_fees');

  useEffect(() => {
    track('onboarding_step_5');
    trackScreenLoad('onboarding_step5', start);
  }, []);

  async function handleContinue() {
    track('onboarding_step_5_continue', { first_expense_type: selected });
    await saveOnboardingAnswers({ first_expense_type: selected });
    router.push('/(auth)/onboarding/step-6');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ProgressBar current={5} total={7} />
      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={{ marginTop: 16, marginBottom: 24, alignSelf: 'flex-start', padding: 4, minHeight: 44, justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, marginBottom: 8 }}>
            Splitting costs is easy
          </Text>
          <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, marginBottom: 8, lineHeight: 22 }}>
            Add an expense and we handle the math. Everyone sees exactly what they owe.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 24 }}>
          <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>Example: Green fees $150 × 4 players</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 22, color: colors.text }}>$600 total</Text>
            <View style={{ backgroundColor: colors.primaryMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 16, color: colors.primary }}>$150 each</Text>
            </View>
          </View>
        </Animated.View>

        <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          What will you track first?
        </Text>

        <FlatList
          data={EXPENSE_TYPES}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, index }) => {
            const isSelected = selected === item.id;
            const Icon = item.icon;
            return (
              <Animated.View entering={FadeInDown.delay(80 + index * 50).duration(350)}>
                <Pressable
                  onPress={() => { setSelected(item.id); track('onboarding_step_5_expense_select', { type: item.id }); }}
                  accessibilityLabel={item.label}
                  accessibilityHint={`Select ${item.label} as your first expense type`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.primary : colors.border,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    gap: 14,
                    opacity: pressed ? 0.8 : 1,
                    minHeight: 56,
                  })}
                >
                  <Icon size={22} color={isSelected ? colors.primary : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text }}>{item.label}</Text>
                    <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary }}>{item.example}</Text>
                  </View>
                  {isSelected && <CheckMark color={colors.primary} />}
                </Pressable>
              </Animated.View>
            );
          }}
        />

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleContinue}
          accessibilityLabel="Continue to scores"
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            minHeight: 54,
            marginTop: 16,
          })}
        >
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary }}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function CheckMark({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>✓</Text>
    </View>
  );
}
