import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { Trophy, BarChart2, Star } from 'lucide-react-native';

const HANDICAP_RANGES = [
  { key: 'scratch', label: 'Scratch (0-5)' },
  { key: 'low', label: 'Low (6-12)' },
  { key: 'mid', label: 'Mid (13-20)' },
  { key: 'high', label: 'High (21+)' },
  { key: 'mixed', label: "Mixed group, all levels" },
];

const SCORE_FEATURES = [
  { icon: Trophy, label: 'Live trip leaderboard', desc: 'Updates after each hole.' },
  { icon: BarChart2, label: 'Net & gross scores', desc: 'Handicap adjustments included.' },
  { icon: Star, label: 'Post-round highlights', desc: "Birdies, eagles, and 'closest to pin'." },
];

export default function Step6() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [handicap, setHandicap] = useState<string>('mixed');

  useEffect(() => {
    track('onboarding_step_6');
    trackScreenLoad('onboarding_step6', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_6_continue', { handicap_range: handicap, score_tracking: true });
    await saveOnboardingAnswers({ handicap_range: handicap, score_tracking: true });
    router.push('/(auth)/onboarding/step-7');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <View style={s.progressBar}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={[s.dot, i === 5 && s.dotActive, i < 5 && s.dotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>Step 6 of 7</Text>
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={s.content}>
        <Text style={s.title}>{"Track scores & run a leaderboard"}</Text>
        <Text style={s.subtitle}>{"After round 1, everyone gets a push notification to log scores. Your leaderboard updates instantly."}</Text>

        <View style={s.featureGrid}>
          {SCORE_FEATURES.map(({ icon: Icon, label, desc }, i) => (
            <Animated.View key={label} entering={FadeInDown.delay(120 + i * 50).springify()} style={s.featureCard}>
              <View style={s.featureIconWrap}>
                <Icon size={20} color={colors.accent} />
              </View>
              <Text style={s.featureLabel}>{label}</Text>
              <Text style={s.featureDesc}>{desc}</Text>
            </Animated.View>
          ))}
        </View>

        <Text style={s.sectionLabel}>{"What's your group's typical handicap?"}</Text>
        <View style={s.pillRow}>
          {HANDICAP_RANGES.map((h) => (
            <Pressable
              key={h.key}
              style={({ pressed }) => [s.pill, handicap === h.key && s.pillSelected, pressed && s.pressed]}
              onPress={() => setHandicap(h.key)}
              accessibilityLabel={`Select handicap range: ${h.label}`}
            >
              <Text style={[s.pillText, handicap === h.key && s.pillTextSelected]}>{h.label}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [s.btnPrimary, pressed && s.pressed]}
          onPress={handleContinue}
          accessibilityLabel="Continue to final step"
        >
          <Text style={s.btnPrimaryText}>Continue</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await saveOnboardingAnswers({ score_tracking: false });
            router.push('/(auth)/onboarding/step-7');
          }}
          style={s.skip}
          accessibilityLabel="Skip score tracking setup"
        >
          <Text style={s.skipText}>{"I'll skip scores"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 24, paddingTop: 12 },
    back: { paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
    backText: { fontSize: 15, fontFamily: 'Manrope_400Regular', color: colors.primary },
    progressBar: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary, width: 24 },
    dotDone: { backgroundColor: colors.secondary },
    stepLabel: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: colors.textMuted, textAlign: 'center' },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
    title: { fontSize: 26, fontFamily: 'Outfit_700Bold', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 15, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, lineHeight: 22, marginBottom: 20 },
    featureGrid: { flexDirection: 'row', gap: 10, marginBottom: 28 },
    featureCard: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, padding: 12, alignItems: 'flex-start', gap: 6,
    },
    featureIconWrap: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.warningMuted, alignItems: 'center', justifyContent: 'center',
    },
    featureLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: colors.text, lineHeight: 16 },
    featureDesc: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, lineHeight: 15 },
    sectionLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: colors.text, marginBottom: 12 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
    },
    pillSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
    pillText: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: colors.textSecondary },
    pillTextSelected: { color: colors.primary, fontFamily: 'Manrope_600SemiBold' },
    footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 8 },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
    btnPrimaryText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textOnPrimary },
    skip: { alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
    skipText: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: colors.textMuted },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  });
