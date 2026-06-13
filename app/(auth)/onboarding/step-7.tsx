import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers, markOnboardingComplete } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { Star, CheckCircle } from 'lucide-react-native';

const PLAN_OPTIONS = [
  {
    id: 'free',
    label: 'Free',
    desc: 'Up to 1 trip, 4 members, basic splits',
    price: '$0',
  },
  {
    id: 'pro',
    label: 'Pro',
    desc: 'Unlimited trips, Recap Cards, priority support',
    price: '$4.99/mo',
  },
];

export default function Step7Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [selected, setSelected] = React.useState<string>('free');

  useEffect(() => {
    track('onboarding_step_7');
    trackScreenLoad('onboarding_step7', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_7_continue', { plan_preference: selected });
    await saveOnboardingAnswers({ recap_interest: selected === 'pro', plan_preference: selected });
    await markOnboardingComplete();
    router.replace('/(auth)/signup');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View entering={FadeInDown.duration(500)} style={s.container}>
        <ProgressDots current={7} total={7} />
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>

        <Star size={36} color={colors.accent} style={{ marginBottom: 16 }} />
        <Text style={s.headline}>{"One last thing."}</Text>
        <Text style={s.sub}>
          {"Pick your plan, you can always upgrade later. The Recap Card (a shareable trip summary your group will love) is a Pro feature."}
        </Text>

        {PLAN_OPTIONS.map((plan, i) => {
          const active = selected === plan.id;
          return (
            <Animated.View key={plan.id} entering={FadeInDown.delay(100 + i * 80).duration(400)}>
              <Pressable
                style={[s.planCard, active && s.planCardActive]}
                onPress={() => setSelected(plan.id)}
                accessibilityLabel={`Select ${plan.label} plan`}
                accessibilityState={{ selected: active }}
              >
                <View style={s.planHeader}>
                  <Text style={[s.planLabel, active && s.planLabelActive]}>{plan.label}</Text>
                  <Text style={[s.planPrice, active && s.planPriceActive]}>{plan.price}</Text>
                </View>
                <Text style={[s.planDesc, active && s.planDescActive]}>{plan.desc}</Text>
                {active && (
                  <CheckCircle size={18} color={active && plan.id === 'pro' ? colors.accent : colors.primary} style={s.check} />
                )}
              </Pressable>
            </Animated.View>
          );
        })}

        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
          <Pressable
            style={s.primaryBtn}
            onPress={handleContinue}
            accessibilityLabel="Create my account"
            accessibilityHint="Proceeds to account creation"
          >
            <Text style={s.primaryBtnText}>Create My Account →</Text>
          </Pressable>
        </Animated.View>

        <Text style={s.legal}>{"By continuing you agree to our Terms & Privacy Policy."}</Text>
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
    sub: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 24 },
    planCard: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 18,
      borderWidth: 1.5, borderColor: colors.border, marginBottom: 12, position: 'relative',
    },
    planCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    planLabel: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: colors.text },
    planLabelActive: { color: colors.primary },
    planPrice: { fontFamily: 'Manrope_700Bold', fontSize: 16, color: colors.textSecondary },
    planPriceActive: { color: colors.primary },
    planDesc: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    planDescActive: { color: colors.text },
    check: { position: 'absolute', top: 16, right: 16 },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: 100,
      paddingVertical: 17, alignItems: 'center', marginTop: 8,
    },
    primaryBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
    legal: {
      textAlign: 'center', fontFamily: 'Manrope_400Regular',
      fontSize: 11, color: colors.textMuted, marginTop: 16, lineHeight: 16,
    },
  });
