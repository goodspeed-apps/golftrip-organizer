import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Link2, MessageCircle, Mail, Users } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';

const STEP = 3;
const TOTAL = 7;
const DEMO_LINK = 'https://golftrip.app/join/DEMO2025';

export default function Step3Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();

  useEffect(() => {
    track('onboarding_step_3');
    trackScreenLoad('OnboardingStep3', start);
  }, []);

  const handleShare = async (method: string) => {
    track('onboarding_step_3_share', { method });
    await saveOnboardingAnswers({ inviteMethod: method });
    await Share.share({ message: `Join my golf trip! ${DEMO_LINK}`, url: DEMO_LINK });
  };

  const handleContinue = async () => {
    track('onboarding_step_3_continue');
    await saveOnboardingAnswers({ inviteMethod: 'skipped' });
    router.push('/(auth)/onboarding/step-4');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}
          accessibilityLabel="Go back" accessibilityHint="Returns to trip setup">
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <View style={s.progressRow}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[s.pip, i < STEP && s.pipActive]} />
          ))}
        </View>
        <Pressable onPress={handleContinue} accessibilityLabel="Skip this step">
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={s.content}>
        <View style={s.confettiBox}>
          <Users size={44} color={colors.accent} />
        </View>
        <Text style={s.stepLabel}>Step {STEP} of {TOTAL}</Text>
        <Text style={s.title}>Invite your crew 🎉</Text>
        <Text style={s.subtitle}>One link gets everyone in, no app download required to view the trip.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).springify()} style={s.linkCard}>
        <Link2 size={18} color={colors.primary} />
        <Text style={s.linkText} numberOfLines={1}>{DEMO_LINK}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).springify()} style={s.shareRow}>
        <Pressable onPress={() => handleShare('sms')}
          style={({ pressed }) => [s.shareBtn, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityLabel="Share via SMS" accessibilityHint="Opens SMS composer with invite link">
          <MessageCircle size={22} color={colors.primary} />
          <Text style={s.shareBtnText}>Text</Text>
        </Pressable>
        <Pressable onPress={() => handleShare('email')}
          style={({ pressed }) => [s.shareBtn, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityLabel="Share via Email" accessibilityHint="Opens email composer with invite link">
          <Mail size={22} color={colors.primary} />
          <Text style={s.shareBtnText}>Email</Text>
        </Pressable>
        <Pressable onPress={() => handleShare('copy')}
          style={({ pressed }) => [s.shareBtn, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityLabel="Copy invite link" accessibilityHint="Copies the invite link to clipboard">
          <Link2 size={22} color={colors.primary} />
          <Text style={s.shareBtnText}>Copy</Text>
        </Pressable>
      </Animated.View>

      <View style={s.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          accessibilityLabel="Continue to group join preview"
        >
          <Text style={s.primaryText}>Continue →</Text>
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
    skipText: { fontFamily: 'Manrope_500Medium', fontSize: 15, color: colors.textSecondary },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    confettiBox: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: colors.surface, alignItems: 'center',
      justifyContent: 'center', borderWidth: 1, borderColor: colors.borderAccent,
    },
    stepLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.textSecondary },
    title: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: colors.text, textAlign: 'center' },
    subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
    linkCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 14, borderWidth: 1, borderColor: colors.borderAccent,
      marginBottom: 16,
    },
    linkText: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: colors.primary, flex: 1 },
    shareRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    shareBtn: {
      flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14,
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    shareBtnText: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.text },
    footer: { paddingBottom: Platform.OS === 'ios' ? 8 : 20 },
    primary: { backgroundColor: colors.primary, borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
    primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
  });
