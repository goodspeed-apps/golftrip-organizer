import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { Eye, UserCheck, CalendarDays } from 'lucide-react-native';
import { ProgressDots } from '@/components/onboarding/ProgressDots';

const FEATURES = [
  { icon: Eye, title: 'No account required', desc: "Your crew sees the full itinerary the moment they tap the link." },
  { icon: UserCheck, title: 'One-tap RSVP', desc: "They confirm they're in without creating a password." },
  { icon: CalendarDays, title: "Always up to date", desc: "Any change you make is live for everyone instantly." },
];

export default function Step4Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());

  useEffect(() => {
    track('onboarding_step_4');
    trackScreenLoad('onboarding_step4', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step4_continue');
    await saveOnboardingAnswers({ guestViewEnabled: true });
    router.push('/(auth)/onboarding/step-5');
  };

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={s.back} testID="step-4-back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <ProgressDots total={7} current={4} colors={colors} />
        <View style={{ width: 60 }} />
      </View>
      <View style={s.container}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.content}>
          <Text style={s.title}>{"What your group sees"}</Text>
          <Text style={s.subtitle}>{"Everyone on the invite list gets a live view of the trip, no friction, just the info they need."}</Text>
          <View style={s.mockCard}>
            <Text style={s.mockTitle}>Golf Trip 2025</Text>
            <Text style={s.mockMeta}>3 rounds · 8 players · Pinehurst, NC</Text>
            <View style={s.divider} />
            <Text style={s.mockRow}>🕗  Tee Time, Round 1, 7:30 AM</Text>
            <Text style={s.mockRow}>🍽  Group Dinner, 7:00 PM</Text>
            <View style={s.rsvpRow}>
              <Text style={s.rsvpCount}>6 of 8 confirmed</Text>
              <View style={s.rsvpBadge}><Text style={s.rsvpBadgeText}>RSVP</Text></View>
            </View>
          </View>
          {FEATURES.map((f, i) => (
            <Animated.View key={f.title} entering={FadeInDown.delay(80 * i).duration(400)} style={s.featureRow}>
              <View style={s.featureIcon}>
                <f.icon size={20} color={colors.primary} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
        <Pressable
          style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={handleContinue}
          accessibilityLabel="Continue to expenses"
          testID="step-4-continue"
        >
          <Text style={s.primaryLabel}>Got it, Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  back: { padding: 8 },
  backText: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, justifyContent: 'space-between' },
  content: { flex: 1, gap: 16, paddingTop: 12 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: c.text },
  subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary, lineHeight: 22 },
  mockCard: { backgroundColor: c.surface, borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: c.border, gap: 8 },
  mockTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: c.text },
  mockMeta: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: c.textSecondary },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
  mockRow: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.text },
  rsvpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  rsvpCount: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: c.textSecondary },
  rsvpBadge: { backgroundColor: c.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  rsvpBadgeText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: c.textOnPrimary },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.text, fontWeight: '600' },
  featureDesc: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: c.textSecondary, lineHeight: 19 },
  primary: { backgroundColor: c.primary, borderRadius: 50, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: c.textOnPrimary },
});
