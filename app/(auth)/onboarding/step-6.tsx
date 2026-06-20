import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { Bell, Trophy } from 'lucide-react-native';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { scheduleLocalNotification } from '@/lib/notifications';
import { captureException } from '@/lib/sentry';

export default function Step6Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [notifEnabled, setNotifEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    track('onboarding_step_6');
    trackScreenLoad('onboarding_step6', startTime.current);
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    track('onboarding_step6_enable_notifications');
    try {
      await scheduleLocalNotification(
        'Round 1 finished?',
        "Log your scores and see who's topping the leaderboard!",
        3,
      );
      setNotifEnabled(true);
      await saveOnboardingAnswers({ notificationsEnabled: true });
    } catch (error) {
      captureException(error as Error, { screen: 'onboarding_step6', action: 'enable_notifications' });
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    track('onboarding_step6_continue', { notifEnabled });
    await saveOnboardingAnswers({ notificationsEnabled: notifEnabled, scoreTrackingEnabled: true });
    router.push('/(auth)/onboarding/step-7');
  };

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={s.back} testID="step-6-back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <ProgressDots total={7} current={6} colors={colors} />
        <Pressable onPress={handleContinue} accessibilityLabel="Skip this step" style={s.skip} testID="step-6-skip">
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>
      <View style={s.container}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.content}>
          <View style={s.iconWrap}>
            <Trophy size={36} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={s.title}>Track scores, build a leaderboard</Text>
          <Text style={s.subtitle}>{"After each round, log scores in seconds. GolfTrip builds a live leaderboard your group will love trash-talking."}</Text>
          <View style={s.mockLeaderboard}>
            <Text style={s.lbTitle}>Trip Leaderboard</Text>
            {[
              { rank: '🥇', name: 'Jake M.', score: '-4' },
              { rank: '🥈', name: 'Chris P.', score: '-2' },
              { rank: '🥉', name: 'You', score: 'E' },
            ].map((row) => (
              <View key={row.name} style={s.lbRow}>
                <Text style={s.lbRank}>{row.rank}</Text>
                <Text style={[s.lbName, row.name === 'You' && { color: colors.primary }]}>{row.name}</Text>
                <View style={s.lbScoreBadge}>
                  <Text style={s.lbScore}>{row.score}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.notifCard}>
            <Bell size={22} color={notifEnabled ? colors.primary : colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={s.notifTitle}>{"Get a nudge when it's time"}</Text>
              <Text style={s.notifBody}>{"We'll remind you right after each round to log scores while they're fresh."}</Text>
            </View>
            <Pressable
              onPress={handleEnableNotifications}
              disabled={notifEnabled || loading}
              style={({ pressed }) => [s.notifBtn, notifEnabled && s.notifBtnDone, { opacity: pressed ? 0.8 : 1 }]}
              accessibilityLabel={notifEnabled ? "Notifications enabled" : "Enable round reminders"}
              testID="step-6-enable-notifications"
            >
              <Text style={[s.notifBtnText, notifEnabled && { color: colors.primary }]}>
                {notifEnabled ? 'Enabled ✓' : loading ? '...' : 'Enable'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
        <Pressable
          style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={handleContinue}
          accessibilityLabel="Continue to the final step"
          testID="step-6-continue"
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
  content: { flex: 1, gap: 16, paddingTop: 8 },
  iconWrap: { width: 70, height: 70, borderRadius: 35, backgroundColor: c.primaryMuted, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 26, color: c.text },
  subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary, lineHeight: 22 },
  mockLeaderboard: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: c.border, gap: 10 },
  lbTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: c.text, marginBottom: 2 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lbRank: { fontSize: 18, width: 28 },
  lbName: { flex: 1, fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.text },
  lbScoreBadge: { backgroundColor: c.primaryMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  lbScore: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: c.primary },
  notifCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: c.border },
  notifTitle: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.text, fontWeight: '600' },
  notifBody: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: c.textSecondary, lineHeight: 17, marginTop: 2 },
  notifBtn: { backgroundColor: c.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  notifBtnDone: { backgroundColor: c.primaryMuted },
  notifBtnText: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: c.textOnPrimary, fontWeight: '600' },
  primary: { backgroundColor: c.primary, borderRadius: 50, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: c.textOnPrimary },
});
