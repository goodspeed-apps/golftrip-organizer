import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { Link2, Mail, MessageSquare, Users } from 'lucide-react-native';
import { ProgressDots } from '@/components/onboarding/ProgressDots';

const DEMO_LINK = 'https://golftrip.app/join/DEMO2025';

export default function Step3Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());

  useEffect(() => {
    track('onboarding_step_3');
    trackScreenLoad('onboarding_step3', startTime.current);
  }, []);

  const handleShare = async (method: string) => {
    track('onboarding_step3_share', { method });
    await saveOnboardingAnswers({ inviteMethod: method });
    try {
      await Share.share({ message: `Join my golf trip! ${DEMO_LINK}`, url: DEMO_LINK });
    } catch { /* user cancelled */ }
  };

  const handleContinue = async () => {
    track('onboarding_step3_continue');
    await saveOnboardingAnswers({ inviteMethod: 'skipped' });
    router.push('/(auth)/onboarding/step-4');
  };

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={s.back} testID="step-3-back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <ProgressDots total={7} current={3} colors={colors} />
        <Pressable onPress={handleContinue} accessibilityLabel="Skip this step" style={s.skip} testID="step-3-skip">
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>
      <View style={s.container}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.content}>
          <View style={s.iconWrap}>
            <Users size={40} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={s.title}>Invite your group</Text>
          <Text style={s.subtitle}>Share one link and everyone can see the full itinerary instantly, no app required.</Text>
          <View style={s.linkBox}>
            <Text style={s.linkText} numberOfLines={1}>{DEMO_LINK}</Text>
            <Pressable
              onPress={() => handleShare('copy')}
              style={({ pressed }) => [s.copyBtn, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityLabel="Copy invite link"
              testID="step-3-copy-link"
            >
              <Link2 size={16} color={colors.textOnPrimary} />
            </Pressable>
          </View>
          <View style={s.methods}>
            <Pressable
              onPress={() => handleShare('sms')}
              style={({ pressed }) => [s.methodCard, { opacity: pressed ? 0.8 : 1 }]}
              accessibilityLabel="Share via SMS"
              accessibilityHint="Opens your messages app with a pre-filled invite"
              testID="step-3-share-sms"
            >
              <MessageSquare size={24} color={colors.primary} />
              <Text style={s.methodLabel}>Text Message</Text>
            </Pressable>
            <Pressable
              onPress={() => handleShare('email')}
              style={({ pressed }) => [s.methodCard, { opacity: pressed ? 0.8 : 1 }]}
              accessibilityLabel="Share via Email"
              accessibilityHint="Opens your email app with a pre-filled invite"
              testID="step-3-share-email"
            >
              <Mail size={24} color={colors.primary} />
              <Text style={s.methodLabel}>Email</Text>
            </Pressable>
            <Pressable
              onPress={() => handleShare('other')}
              style={({ pressed }) => [s.methodCard, { opacity: pressed ? 0.8 : 1 }]}
              accessibilityLabel="Share via other apps"
              accessibilityHint="Opens the system share sheet"
              testID="step-3-share-other"
            >
              <Link2 size={24} color={colors.primary} />
              <Text style={s.methodLabel}>More Options</Text>
            </Pressable>
          </View>
        </Animated.View>
        <Pressable
          style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={handleContinue}
          accessibilityLabel="Continue to next step"
          testID="step-3-continue"
        >
          <Text style={s.primaryLabel}>Continue</Text>
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
  skip: { padding: 8 },
  skipText: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, justifyContent: 'space-between' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: c.text, textAlign: 'center' },
  subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
  linkBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: c.primary, borderRadius: 12, paddingLeft: 14, overflow: 'hidden', width: '100%', backgroundColor: c.surface },
  linkText: { flex: 1, fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.text, paddingVertical: 12 },
  copyBtn: { backgroundColor: c.primary, padding: 14, alignItems: 'center', justifyContent: 'center' },
  methods: { flexDirection: 'row', gap: 12, width: '100%' },
  methodCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, gap: 8 },
  methodLabel: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: c.text, textAlign: 'center' },
  primary: { backgroundColor: c.primary, borderRadius: 50, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: c.textOnPrimary },
});
