import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { DollarSign } from 'lucide-react-native';

export default function Step5Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());

  useEffect(() => {
    track('onboarding_step_5');
    trackScreenLoad('onboarding_step5', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_5_continue', { expense_awareness: true });
    await saveOnboardingAnswers({ expense_awareness: true });
    router.push('/(auth)/onboarding/step-6');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View entering={FadeInDown.duration(500)} style={s.container}>
        <ProgressDots current={5} total={7} />
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>

        <DollarSign size={36} color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={s.headline}>{"Splits, handled."}</Text>
        <Text style={s.sub}>
          {"Log a shared expense and everyone sees exactly what they owe, instantly. No group chat math, no awkward follow-ups."}
        </Text>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.previewCard}>
          <Text style={s.cardLabel}>Green fees · 4 players</Text>
          <Text style={s.cardAmount}>$600.00</Text>
          <View style={s.divider} />
          {[
            { name: 'You', amount: '$150.00', settled: true },
            { name: 'Marcus', amount: '$150.00', settled: false },
            { name: 'Jake', amount: '$150.00', settled: false },
            { name: 'Drew', amount: '$150.00', settled: false },
          ].map((row, i) => (
            <Animated.View key={row.name} entering={FadeInDown.delay(200 + i * 50).duration(300)} style={s.splitRow}>
              <Text style={s.splitName}>{row.name}</Text>
              <View style={[s.badge, { backgroundColor: row.settled ? colors.positiveMuted : colors.warningMuted }]}>
                <Text style={[s.badgeText, { color: row.settled ? colors.positive : colors.warning }]}>
                  {row.settled ? 'Paid' : row.amount}
                </Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        <Pressable
          style={s.primaryBtn}
          onPress={handleContinue}
          accessibilityLabel="Continue to next step"
        >
          <Text style={s.primaryBtnText}>{"That's exactly what I need →"}</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32 },
    back: { marginBottom: 20, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    backText: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.textSecondary },
    headline: { fontFamily: 'Outfit_700Bold', fontSize: 32, color: colors.text, marginBottom: 8 },
    sub: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 28 },
    previewCard: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 20,
      borderWidth: 1, borderColor: colors.border, marginBottom: 32,
    },
    cardLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
    cardAmount: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, marginBottom: 12 },
    divider: { height: 1, backgroundColor: colors.divider, marginBottom: 12 },
    splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    splitName: { fontFamily: 'Manrope_500Medium', fontSize: 15, color: colors.text },
    badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontFamily: 'Manrope_600SemiBold', fontSize: 13 },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: 100,
      paddingVertical: 17, alignItems: 'center',
    },
    primaryBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: colors.textOnPrimary },
  });
