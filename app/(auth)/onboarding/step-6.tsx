import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Trophy, Bell } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { requestPermissionAndRegister } from '@/lib/notifications';
import { captureException } from '@/lib/sentry';

const STEP = 6;
const TOTAL = 7;

export default function Step6Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const start = Date.now();

  useEffect(() => {
    track('onboarding_step_6');
    trackScreenLoad('OnboardingStep6', start);
  }, []);

  const handleEnableNotifications = async () => {
    if (requesting) return;
    setRequesting(true);
    track('onboarding_step_6_notif_request');
    try {
      await requestPermissionAndRegister(user?.id ?? '');
      setNotifEnabled(true);
      track('onboarding_step_6_notif_granted');
    } catch (error) {
      captureException(error as Error, { screen: 'OnboardingStep6', action: 'requestPermission' });
    } finally {
      setRequesting(false);
    }
  };

  const handleContinue = async () => {
    track('onboarding_step_6_continue', { notificationsEnabled: notifEnabled });
    await saveOnboardingAnswers({ notificationsEnabled: notifEnabled, scoreTracking: true });
    router.push('/(auth)/onboarding/step-7');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}
          accessibilityLabel="Go back" accessibilityHint="Returns to expenses step">
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
        <View style={s.trophyBox}>
          <Trophy size={44} color={colors.accent} strokeWidth={2} />
        </View>
        <Text style={s.stepLabel}>Step {STEP} of {TOTAL}</Text>
        <Text style={s.title}>Track scores. Settle bragging rights.</Text>
        <Text style={s.subtitle}>{"After each round, log scores and your group leaderboard updates live. Turn on notifications so nobody misses the moment."}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={s.leaderboard}>
        {[
          { rank: 1, name: 'You', score: '-4', color: colors.accent },
          { rank: 2, name: 'Mike', score: '-2', color: colors.text },
          { rank: 3, name: 'Sarah', score: 'E', color: colors.textSecondary },
        ].map((row) => (
          <View key={row.rank} style={s.lbRow}>
            <Text style={[s.lbRank, { color: row.rank === 1 ? colors.accent : colors.textSecondary }]}>{row.rank}</Text>
            <Text style={[s.lbName, { color: row.color }]}>{row.name}</Text>
            <Text style={[s.lbScore, { color: row.rank === 1 ? colors.accent : colors.text }]}>{row.score}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(280).springify()} style={s.notifCard}>
        <Bell size={22} color={notifEnabled ? colors.accent : colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.notifTitle}>{notifEnabled ? "You're all set for round alerts!" : "Get round completion alerts"}</Text>
          <Text style={s.notifBody}>{notifEnabled ? "We'll ping you when scores are ready to log." : "We only send reminders when it counts."}</Text>
        </View>
        {!notifEnabled && (
          <Pressable
            onPress={handleEnableNotifications}
            disabled={requesting}
            style={({ pressed }) => [s.notifBtn, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityLabel="Enable round notifications"
            accessibilityHint="Requests permission to send round completion reminders"
          >
            <Text style={s.notifBtnText}>{requesting ? '...' : 'Enable'}</Text>
          </Pressable>
        )}
      </Animated.View>

      <View style={s.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          accessibilityLabel="Continue to trip recap"
        >
          <Text style={s.primaryText}>Almost there →</Text>
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
    hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 16 },
    trophyBox: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: colors.surface, alignItems: 'center',
      justifyContent: 'center', borderWidth: 1, borderColor: colors.borderAccent,
    },
    stepLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.textSecondary },
    title: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, textAlign: 'center', lineHeight: 36 },
    subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 23 },
    leaderboard: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      marginBottom: 14, borderWidth: 1, borderColor: colors.border, gap: 12,
    },
    lbRow: { flexDirection: 'row', alignItems: 'center' },
    lbRank: { fontFamily: 'Outfit_700Bold', fontSize: 18, width: 28 },
    lbName: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15 },
    lbScore: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
    notifCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      marginBottom: 20, borderWidth: 1, borderColor: colors.borderAccent,
    },
    notifTitle: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: colors.text },
    notifBody: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    notifBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
    notifBtnText: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textOnPrimary },
    footer: { paddingBottom: Platform.OS === 'ios' ? 8 : 20 },
    primary: { backgroundColor: colors.primary, borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
    primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
  });
