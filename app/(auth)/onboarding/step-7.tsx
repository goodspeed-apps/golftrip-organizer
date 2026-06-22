import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSubscription } from '@/hooks/useSubscription';
import { trackScreenLoad } from '@/lib/performance';
import { saveOnboardingAnswers, markOnboardingComplete } from '@/lib/onboarding-buffer';
import { Star, Share2, Lock } from 'lucide-react-native';
import { ProgressDots } from '@/components/onboarding/ProgressDots';

export default function Step7Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const { offerings, isSubscribed } = useSubscription();
  const startTime = React.useRef(Date.now());
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    track('onboarding_step_7');
    trackScreenLoad('onboarding_step7', startTime.current);
  }, []);

  const packages = offerings?.current?.availablePackages ?? [];
  const firstPackage = packages[0] ?? null;
  const priceString = firstPackage?.product?.priceString ?? null;

  const handleContinue = async () => {
    setFinishing(true);
    track('onboarding_step7_continue', { isSubscribed });
    await saveOnboardingAnswers({ recapCardEnabled: true, planTier: isSubscribed ? 'pro' : 'free' });
    await markOnboardingComplete();
    router.replace('/(auth)/signup');
  };

  const handleUnlock = () => {
    track('onboarding_step7_unlock_pro');
  };

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={s.back} testID="step-7-back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <ProgressDots total={7} current={7} colors={colors} />
        <View style={{ width: 60 }} />
      </View>
      <View style={s.container}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.content}>
          <View style={s.iconWrap}>
            <Share2 size={36} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={s.title}>End every trip on a high note</Text>
          <Text style={s.subtitle}>{"Generate a Recap Card, the shareable trip summary your group will screenshot and show off for years."}</Text>
          <View style={s.recapMock}>
            <Text style={s.recapEmoji}>🏌️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.recapTripName}>Golf Trip 2025</Text>
              <Text style={s.recapMeta}>3 rounds · 8 players · Pinehurst, NC</Text>
              <Text style={s.recapStat}>🥇 Low scorer: Jake M. at -8</Text>
              <Text style={s.recapStat}>💰 Total spent: $2,340 · $292.50 / person</Text>
            </View>
          </View>
          <View style={s.planCard}>
            <View style={s.planRow}>
              <Star size={20} color={colors.accent} strokeWidth={1.5} />
              <Text style={s.planTitle}>GolfTrip Pro</Text>
              {priceString ? (
                <Text style={s.planPrice}>{priceString}/mo</Text>
              ) : offerings === undefined ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={s.planPrice}>Free during beta</Text>
              )}
            </View>
            <View style={s.planFeatures}>
              {["Unlimited Recap Cards", "Unlimited trips & members", "Advanced expense reports", "Priority support"].map(f => (
                <Text key={f} style={s.planFeature}>✓  {f}</Text>
              ))}
            </View>
            {!isSubscribed && (
              <Pressable
                onPress={handleUnlock}
                style={({ pressed }) => [s.unlockBtn, { opacity: pressed ? 0.8 : 1 }]}
                accessibilityLabel="Unlock GolfTrip Pro"
                testID="step-7-unlock-pro"
              >
                <Lock size={14} color={colors.textOnPrimary} />
                <Text style={s.unlockLabel}>
                  {priceString ? `Unlock for ${priceString}/mo` : "Unlock Pro"}
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
        <Pressable
          style={({ pressed }) => [s.primary, finishing && s.disabled, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={handleContinue}
          disabled={finishing}
          accessibilityLabel="Create your account"
          accessibilityHint="Navigates to signup screen"
          testID="step-7-continue"
        >
          {finishing ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={s.primaryLabel}>Create My Account</Text>
          )}
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
  content: { flex: 1, gap: 16, paddingTop: 8 },
  iconWrap: { width: 70, height: 70, borderRadius: 35, backgroundColor: c.primaryMuted, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 26, color: c.text },
  subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary, lineHeight: 22 },
  recapMock: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: c.border },
  recapEmoji: { fontSize: 32 },
  recapTripName: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: c.text },
  recapMeta: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: c.textSecondary, marginBottom: 4 },
  recapStat: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: c.text, lineHeight: 20 },
  planCard: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: c.accent, gap: 12 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 16, color: c.text },
  planPrice: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.textSecondary },
  planFeatures: { gap: 4 },
  planFeature: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: c.textSecondary, lineHeight: 20 },
  unlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.accent, borderRadius: 50, paddingVertical: 12 },
  unlockLabel: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: c.textOnPrimary },
  primary: { backgroundColor: c.primary, borderRadius: 50, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: c.textOnPrimary },
  disabled: { opacity: 0.6 },
});
