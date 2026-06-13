import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { Link2, Mail, MessageSquare } from 'lucide-react-native';

const MOCK_LINK = 'https://golftrip.app/join/ABC123';

export default function Step3Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());

  useEffect(() => {
    track('onboarding_step_3');
    trackScreenLoad('onboarding_step3', startTime.current);
  }, []);

  const handleShare = async () => {
    track('onboarding_step_3_share', { method: 'native' });
    await Share.share({ message: `Join my golf trip! ${MOCK_LINK}`, url: MOCK_LINK });
  };

  const handleContinue = async () => {
    track('onboarding_step_3_continue', { invite_method: 'link' });
    await saveOnboardingAnswers({ invite_method: 'link' });
    router.push('/(auth)/onboarding/step-4');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View entering={FadeInDown.duration(500)} style={s.container}>
        <ProgressDots current={3} total={7} />
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>

        <Text style={s.headline}>{"Your trip is live! 🎉"}</Text>
        <Text style={s.sub}>{"Share the invite link and your group joins instantly, no account needed to view the itinerary."}</Text>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.linkCard}>
          <Link2 size={18} color={colors.accent} />
          <Text style={s.linkText} numberOfLines={1}>{MOCK_LINK}</Text>
        </Animated.View>

        <Pressable
          style={s.primaryBtn}
          onPress={handleShare}
          accessibilityLabel="Share invite link with group"
          accessibilityHint="Opens native share sheet"
        >
          <Text style={s.primaryBtnText}>Share with Group</Text>
        </Pressable>

        {[
          { icon: <Mail size={18} color={colors.primary} />, label: 'Send via Email' },
          { icon: <MessageSquare size={18} color={colors.primary} />, label: 'Send via SMS' },
        ].map((opt, i) => (
          <Animated.View key={opt.label} entering={FadeInDown.delay(250 + i * 60).duration(400)}>
            <Pressable
              style={s.secondaryBtn}
              onPress={handleShare}
              accessibilityLabel={opt.label}
            >
              {opt.icon}
              <Text style={s.secondaryBtnText}>{opt.label}</Text>
            </Pressable>
          </Animated.View>
        ))}

        <Pressable style={s.skipBtn} onPress={handleContinue} accessibilityLabel="Skip for now">
          <Text style={s.skipText}>Skip for now →</Text>
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
    linkCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.surfaceElevated, borderRadius: 12,
      padding: 16, borderWidth: 1, borderColor: colors.borderAccent, marginBottom: 20,
    },
    linkText: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: colors.accent, flex: 1 },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: 100,
      paddingVertical: 17, alignItems: 'center', marginBottom: 12,
    },
    primaryBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
    secondaryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.surface, borderRadius: 100,
      paddingVertical: 15, paddingHorizontal: 24,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10, justifyContent: 'center',
    },
    secondaryBtnText: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.primary },
    skipBtn: { marginTop: 16, alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
    skipText: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: colors.textSecondary },
  });
