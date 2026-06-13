import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Eye, UserCheck, Globe } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';

const STEP = 4;
const TOTAL = 7;

const FEATURES = [
  { icon: Globe, title: 'No account needed to view', body: "Members tap the link and see the full itinerary right in their browser, nothing to install." },
  { icon: Eye, title: 'Full itinerary visible', body: "Tee times, accommodation, the group chat, all there from day one." },
  { icon: UserCheck, title: 'RSVP with one tap', body: "They confirm their spot in seconds. You see the headcount update live." },
];

export default function Step4Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();

  useEffect(() => {
    track('onboarding_step_4');
    trackScreenLoad('OnboardingStep4', start);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_4_continue');
    await saveOnboardingAnswers({ guestViewEnabled: true });
    router.push('/(auth)/onboarding/step-5');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}
          accessibilityLabel="Go back" accessibilityHint="Returns to invite step">
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
        <Text style={s.title}>Your group sees everything instantly</Text>
        <Text style={s.subtitle}>Here's what happens the moment someone taps your invite link.</Text>
      </Animated.View>

      <View style={s.cards}>
        {FEATURES.map((f, i) => (
          <Animated.View key={f.title} entering={FadeInDown.delay(160 + i * 60).springify()} style={s.card}>
            <View style={s.iconBox}>
              <f.icon size={22} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{f.title}</Text>
              <Text style={s.cardBody}>{f.body}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <View style={s.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          accessibilityLabel="Continue to expenses overview"
        >
          <Text style={s.primaryText}>Got it →</Text>
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
    intro: { paddingTop: 32, paddingBottom: 24, gap: 8 },
    stepLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.textSecondary },
    title: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, lineHeight: 36 },
    subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    cards: { flex: 1, gap: 14, justifyContent: 'center' },
    card: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 14,
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    iconBox: {
      width: 44, height: 44, borderRadius: 12,
      backgroundColor: colors.background, alignItems: 'center',
      justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    cardTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text, marginBottom: 4 },
    cardBody: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    footer: { paddingBottom: Platform.OS === 'ios' ? 8 : 20 },
    primary: { backgroundColor: colors.primary, borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
    primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
  });
