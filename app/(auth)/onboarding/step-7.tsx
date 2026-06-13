import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Star, Share2, Lock } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers, markOnboardingComplete } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';

const STEP = 7;
const TOTAL = 7;

const PLANS = [
  {
    key: 'free',
    label: 'Free',
    desc: 'Up to 1 trip, 5 members, basic splits',
    price: '$0',
  },
  {
    key: 'pro',
    label: 'Pro',
    desc: 'Unlimited trips, recap cards, full history',
    price: '$4.99/mo',
    highlight: true,
  },
];

export default function Step7Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const [selectedPlan, setSelectedPlan] = useState<string>('pro');
  const [loading, setLoading] = useState(false);
  const start = Date.now();

  useEffect(() => {
    track('onboarding_step_7');
    trackScreenLoad('OnboardingStep7', start);
  }, []);

  const handleContinue = async () => {
    if (loading) return;
    setLoading(true);
    track('onboarding_step_7_continue', { planType: selectedPlan });
    await saveOnboardingAnswers({ recapInterest: true, planType: selectedPlan });
    await markOnboardingComplete();
    router.replace('/(auth)/signup');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}
          accessibilityLabel="Go back" accessibilityHint="Returns to score tracking step">
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <View style={s.progressRow}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[s.pip, i < STEP && s.pipActive]} />
          ))}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={s.hero}>
        <View style={s.iconBox}>
          <Share2 size={40} color={colors.accent} />
        </View>
        <Text style={s.stepLabel}>Step {STEP} of {TOTAL}</Text>
        <Text style={s.title}>Your Recap Card, the trip your crew will never forget</Text>
        <Text style={s.subtitle}>A shareable highlight reel: best round, biggest expense, who owed who. Ready to save as an image.</Text>
      </Animated.View>

      <View style={s.planRow}>
        {PLANS.map((p, i) => (
          <Animated.View key={p.key} entering={FadeInDown.delay(160 + i * 60).springify()} style={{ flex: 1 }}>
            <Pressable
              onPress={() => { setSelectedPlan(p.key); track('onboarding_step_7_plan', { plan: p.key }); }}
              style={[s.planCard, selectedPlan === p.key && s.planCardActive, p.highlight && selectedPlan === p.key && s.planCardPro]}
              accessibilityLabel={`Select ${p.label} plan`}
              accessibilityHint={p.desc}
            >
              {p.highlight && (
                <View style={s.badge}>
                  <Star size={11} color={colors.accent} />
                  <Text style={s.badgeText}>Popular</Text>
                </View>
              )}
              <Text style={[s.planLabel, p.highlight && selectedPlan === p.key && s.planLabelPro]}>{p.label}</Text>
              <Text style={[s.planPrice, p.highlight && selectedPlan === p.key && s.planPricePro]}>{p.price}</Text>
              <Text style={[s.planDesc, { color: colors.textSecondary }]}>{p.desc}</Text>
              {p.key === 'free' && (
                <View style={s.lockRow}>
                  <Lock size={12} color={colors.textMuted} />
                  <Text style={s.lockText}>Recap Card locked</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <View style={s.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={loading}
          style={({ pressed }) => [s.primary, { opacity: pressed || loading ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          accessibilityLabel="Create your account"
          accessibilityHint="Proceeds to sign up with your chosen plan"
        >
          <Text style={s.primaryText}>{loading ? "One moment..." : "Create My Account →"}</Text>
        </Pressable>
        <Text style={s.legalText}>You can change your plan any time. No commitment.</Text>
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
    hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    iconBox: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.surface, alignItems: 'center',
      justifyContent: 'center', borderWidth: 1, borderColor: colors.borderAccent,
    },
    stepLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.textSecondary },
    title: { fontFamily: 'Outfit_700Bold', fontSize: 26, color: colors.text, textAlign: 'center', lineHeight: 34 },
    subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    planRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    planCard: {
      borderRadius: 16, padding: 16, borderWidth: 1.5,
      borderColor: colors.border, backgroundColor: colors.surface, gap: 4,
    },
    planCardActive: { borderColor: colors.primary },
    planCardPro: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    badgeText: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, color: colors.accent },
    planLabel: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: colors.text },
    planLabelPro: { color: colors.primary },
    planPrice: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: colors.text },
    planPricePro: { color: colors.primary },
    planDesc: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18 },
    lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    lockText: { fontFamily: 'Manrope_400Regular', fontSize: 11, color: colors.textMuted },
    footer: { paddingBottom: Platform.OS === 'ios' ? 8 : 20, gap: 8 },
    primary: { backgroundColor: colors.primary, borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
    primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
    legalText: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  });
