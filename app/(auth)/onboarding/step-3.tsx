import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers, getOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { Link2, MessageCircle, Mail, Users } from 'lucide-react-native';
import { gasConfig } from '../../../gas.config';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? gasConfig.app.scheme + '://';

export default function Step3() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [inviteMethod, setInviteMethod] = useState<string>('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    track('onboarding_step_3');
    trackScreenLoad('onboarding_step3', startTime.current);
    loadInviteLink();
  }, []);

  const loadInviteLink = async () => {
    const answers = await getOnboardingAnswers();
    const code = answers?.invite_code as string | undefined;
    if (code) {
      setInviteLink(`${APP_URL}/join/${code}`);
    }
  };

  const handleShare = async (method: string) => {
    if (!inviteLink) return;
    setInviteMethod(method);
    track('onboarding_invite_share', { method });
    await Share.share({ message: `Join my golf trip! ${inviteLink}`, url: inviteLink });
  };

  const handleContinue = async () => {
    track('onboarding_step_3_continue', { invite_method: inviteMethod || 'skipped' });
    await saveOnboardingAnswers({ invite_method: inviteMethod || 'skipped' });
    router.push('/(auth)/onboarding/step-4');
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
            <View key={i} style={[s.dot, i === 2 && s.dotActive, i < 2 && s.dotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>Step 3 of 7</Text>
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={s.content}>
        <View style={s.celebration}>
          <Text style={s.emoji}>🎉</Text>
          <Text style={s.title}>Trip created!{`\n`}Invite your crew</Text>
          <Text style={s.subtitle}>{"Share this link and everyone gets the full itinerary instantly, no app required."}</Text>
        </View>

        <View style={s.linkCard}>
          <Link2 size={16} color={colors.primary} />
          {inviteLink ? (
            <Text style={s.linkText} numberOfLines={1}>{inviteLink}</Text>
          ) : (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />
          )}
        </View>

        <Text style={s.sectionLabel}>Quick share</Text>
        <View style={s.shareRow}>
          <Pressable
            style={({ pressed }) => [s.shareChip, pressed && s.pressed, !inviteLink && s.disabled]}
            onPress={() => handleShare('sms')}
            disabled={!inviteLink}
            accessibilityLabel="Share via SMS"
          >
            <MessageCircle size={20} color={colors.primary} />
            <Text style={s.shareChipText}>Text</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.shareChip, pressed && s.pressed, !inviteLink && s.disabled]}
            onPress={() => handleShare('email')}
            disabled={!inviteLink}
            accessibilityLabel="Share via Email"
          >
            <Mail size={20} color={colors.primary} />
            <Text style={s.shareChipText}>Email</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.shareChip, pressed && s.pressed, !inviteLink && s.disabled]}
            onPress={() => handleShare('other')}
            disabled={!inviteLink}
            accessibilityLabel="Share via other app"
          >
            <Users size={20} color={colors.primary} />
            <Text style={s.shareChipText}>More</Text>
          </Pressable>
        </View>

        <Text style={s.nudge}>
          {"Group members see the full itinerary right away. They can RSVP without creating an account."}
        </Text>
      </Animated.View>

      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [s.btnPrimary, pressed && s.pressed]}
          onPress={handleContinue}
          accessibilityLabel="Continue to group joining step"
        >
          <Text style={s.btnPrimaryText}>Continue</Text>
        </Pressable>
        <Pressable onPress={handleContinue} style={s.skip} accessibilityLabel="Skip inviting for now">
          <Text style={s.skipText}>Skip for now</Text>
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
    celebration: { alignItems: 'center', marginBottom: 24 },
    emoji: { fontSize: 48, marginBottom: 8 },
    title: { fontSize: 28, fontFamily: 'Outfit_700Bold', color: colors.text, textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 15, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    linkCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.borderAccent, padding: 14, marginBottom: 24,
    },
    linkText: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: colors.primary, flex: 1 },
    sectionLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
    shareRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    shareChip: {
      flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, paddingVertical: 16,
    },
    shareChipText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: colors.primary },
    nudge: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, lineHeight: 22, textAlign: 'center' },
    footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 8 },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
    btnPrimaryText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textOnPrimary },
    skip: { alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
    skipText: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: colors.textMuted },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
    disabled: { opacity: 0.4 },
  });
