import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers, markOnboardingComplete } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ChevronLeft, Star, Share2, Image, Lock } from 'lucide-react-native';

const PERKS = [
  { icon: Image, label: 'Trip Recap Card', desc: 'A shareable highlight reel your group will save' },
  { icon: Share2, label: 'Unlimited invites', desc: 'Bring the whole club, no cap on group size' },
  { icon: Star, label: 'Priority tee time alerts', desc: 'First to know when slots open' },
];

export default function Step7Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();
  const [selected, setSelected] = useState<'free' | 'pro'>('free');

  useEffect(() => {
    track('onboarding_step_7');
    trackScreenLoad('onboarding_step7', start);
  }, []);

  async function handleContinue() {
    track('onboarding_step_7_continue', { plan_tier: selected });
    await saveOnboardingAnswers({ recap_interest: selected === 'pro', plan_tier: selected });
    await markOnboardingComplete();
    router.replace('/(auth)/signup');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ProgressBar current={7} total={7} />
      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={{ marginTop: 16, marginBottom: 20, alignSelf: 'flex-start', padding: 4, minHeight: 44, justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, textAlign: 'center', marginBottom: 8 }}>
            One last thing
          </Text>
          <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            {"GolfTrip is free for organizing. Unlock the Recap Card and extras with Pro, cancel anytime."}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ gap: 12, marginBottom: 24 }}>
          {PERKS.map(({ icon: Icon, label, desc }, index) => (
            <Animated.View key={label} entering={FadeInDown.delay(80 + index * 50).duration(350)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, gap: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.warningMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text }}>{label}</Text>
                  <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary }}>{desc}</Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ gap: 10 }}>
          {[
            { id: 'free', label: 'Start Free', sublabel: 'Core organizing, always free', badge: null },
            { id: 'pro', label: 'Go Pro, $4.99/mo', sublabel: 'Recap Card + unlimited group features', badge: 'Popular' },
          ].map((opt) => {
            const isSelected = selected === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => { setSelected(opt.id as 'free' | 'pro'); track('onboarding_step_7_plan_select', { plan: opt.id }); }}
                accessibilityLabel={opt.label}
                accessibilityHint={opt.sublabel}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: isSelected ? colors.primary : colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  gap: 12,
                  opacity: pressed ? 0.8 : 1,
                  minHeight: 60,
                })}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected && <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontWeight: '700' }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 15, color: colors.text }}>{opt.label}</Text>
                    {opt.badge && (
                      <View style={{ backgroundColor: colors.warning, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 11, color: colors.textOnPrimary }}>{opt.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary }}>{opt.sublabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleContinue}
          accessibilityLabel="Create my account"
          accessibilityHint="Finish onboarding and create your account"
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
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary }}>
            Create My Account
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          <Lock size={13} color={colors.textMuted} />
          <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 12, color: colors.textMuted }}>
            No credit card required for free plan
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
