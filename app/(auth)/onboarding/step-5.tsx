import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, DollarSign, Flag, Coffee } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';

const STEP = 5;
const TOTAL = 7;

const EXPENSE_TYPES = [
  { key: 'green_fees', label: 'Green Fees', icon: Flag, example: '$150 / player' },
  { key: 'accommodation', label: 'Accommodation', icon: Coffee, example: '$90 / night' },
  { key: 'food_drink', label: 'Food & Drinks', icon: DollarSign, example: 'Split the tab' },
];

export default function Step5Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const [selected, setSelected] = useState<string>('green_fees');
  const start = Date.now();

  useEffect(() => {
    track('onboarding_step_5');
    trackScreenLoad('OnboardingStep5', start);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_5_continue', { firstExpenseType: selected });
    await saveOnboardingAnswers({ firstExpenseType: selected });
    router.push('/(auth)/onboarding/step-6');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}
          accessibilityLabel="Go back" accessibilityHint="Returns to group view step">
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <View style={s.progressRow}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[s.pip, i < STEP && s.pipActive]} />
          ))}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={s.intro}>
        <Text style={s.stepLabel}>Step {STEP} of {TOTAL}</Text>
        <Text style={s.title}>Splits, done automatically</Text>
        <Text style={s.subtitle}>What kind of expenses does your group usually share? Pick the most common one.</Text>
      </Animated.View>

      <View style={s.optionList}>
        {EXPENSE_TYPES.map((e, i) => {
          const active = selected === e.key;
          return (
            <Animated.View key={e.key} entering={FadeInDown.delay(160 + i * 60).springify()}>
              <Pressable
                onPress={() => { setSelected(e.key); track('onboarding_step_5_select', { type: e.key }); }}
                style={[s.option, active && s.optionActive]}
                accessibilityLabel={`Select ${e.label}`}
                accessibilityHint={`Set ${e.label} as your primary expense type`}
              >
                <View style={[s.optionIcon, active && s.optionIconActive]}>
                  <e.icon size={20} color={active ? colors.textOnPrimary : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionTitle, active && s.optionTitleActive]}>{e.label}</Text>
                  <Text style={[s.optionExample, active && s.optionExampleActive]}>{e.example}</Text>
                </View>
                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View entering={FadeInDown.delay(340).springify()} style={s.splitPreview}>
        <Text style={s.splitLabel}>4 players · $150 green fee</Text>
        <Text style={s.splitAmount}>$37.50 / person</Text>
      </Animated.View>

      <View style={s.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          accessibilityLabel="Continue to score tracking"
        >
          <Text style={s.primaryText}>Looks good →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, gap: 8 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    progressRow: { flex: 1, flexDirection: 'row', gap: 6 },
    pip: { height: 4, flex: 1, borderRadius: 2, backgroundColor: colors.border },
    pipActive: { backgroundColor: colors.primary },
    intro: { paddingTop: 28, paddingBottom: 20, gap: 8 },
    stepLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.textSecondary },
    title: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, lineHeight: 36 },
    subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    optionList: { gap: 12, flex: 1, justifyContent: 'center' },
    option: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 16, borderWidth: 1.5, borderColor: colors.border,
    },
    optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
    optionIcon: {
      width: 44, height: 44, borderRadius: 12,
      backgroundColor: colors.background, alignItems: 'center',
      justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    optionIconActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    optionTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text },
    optionTitleActive: { color: colors.primary },
    optionExample: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary },
    optionExampleActive: { color: colors.textSecondary },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    splitPreview: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      marginBottom: 16, borderWidth: 1, borderColor: colors.borderAccent,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    splitLabel: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: colors.textSecondary },
    splitAmount: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: colors.accent },
    footer: { paddingBottom: Platform.OS === 'ios' ? 8 : 20 },
    primary: { backgroundColor: colors.primary, borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
    primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
  });
