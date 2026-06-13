import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { Trophy, Bell } from 'lucide-react-native';

const LEADERBOARD = [
  { rank: 1, name: 'Jake', score: '+3', net: '68' },
  { rank: 2, name: 'You', score: '+5', net: '70' },
  { rank: 3, name: 'Marcus', score: '+7', net: '72' },
  { rank: 4, name: 'Drew', score: '+9', net: '74' },
];

export default function Step6Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());

  useEffect(() => {
    track('onboarding_step_6');
    trackScreenLoad('onboarding_step6', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_6_continue', { score_tracking: true, notifications_opted_in: true });
    await saveOnboardingAnswers({ score_tracking: true, notifications_opted_in: true });
    router.push('/(auth)/onboarding/step-7');
  };

  const handleSkip = async () => {
    track('onboarding_step_6_skip');
    await saveOnboardingAnswers({ score_tracking: true, notifications_opted_in: false });
    router.push('/(auth)/onboarding/step-7');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View entering={FadeInDown.duration(500)} style={s.container}>
        <ProgressDots current={6} total={7} />
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>

        <Trophy size={36} color={colors.accent} style={{ marginBottom: 16 }} />
        <Text style={s.headline}>{"Live leaderboard."}</Text>
        <Text style={s.sub}>{"Enter scores after each round and the leaderboard updates instantly. Your group will be trash-talking within minutes."}</Text>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.card}>
          {LEADERBOARD.map((p, i) => (
            <Animated.View key={p.name} entering={FadeInDown.delay(200 + i * 50).duration(300)} style={s.row}>
              <View style={[s.rankBadge, p.rank === 1 && { backgroundColor: colors.accent }]}>
                {p.rank === 1
                  ? <Trophy size={12} color={colors.background} />
                  : <Text style={[s.rankText, { color: colors.textSecondary }]}>{p.rank}</Text>
                }
              </View>
              <Text style={[s.playerName, p.name === 'You' && { color: colors.primary, fontFamily: 'Manrope_700Bold' }]}>{p.name}</Text>
              <Text style={s.scoreText}>{p.score}</Text>
              <Text style={s.netText}>Net {p.net}</Text>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).duration(400)} style={s.notifBanner}>
          <Bell size={16} color={colors.primary} />
          <Text style={s.notifText}>{"We'll nudge you after each round to log scores, never miss a moment."}</Text>
        </Animated.View>

        <Pressable
          style={s.primaryBtn}
          onPress={handleContinue}
          accessibilityLabel="Enable score tracking and notifications"
        >
          <Text style={s.primaryBtnText}>Enable Score Tracking →</Text>
        </Pressable>
        <Pressable style={s.skipBtn} onPress={handleSkip} accessibilityLabel="Skip notifications">
          <Text style={s.skipText}>Skip for now</Text>
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
    sub: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 24 },
    card: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 16,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    rankBadge: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center', justifyContent: 'center',
    },
    rankText: { fontFamily: 'Manrope_700Bold', fontSize: 13 },
    playerName: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15, color: colors.text },
    scoreText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: colors.textSecondary, marginRight: 8 },
    netText: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textMuted },
    notifBanner: {
      flexDirection: 'row', gap: 10, alignItems: 'flex-start',
      backgroundColor: colors.primaryMuted, borderRadius: 12, padding: 14, marginBottom: 24,
    },
    notifText: { flex: 1, fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.text, lineHeight: 20 },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: 100,
      paddingVertical: 17, alignItems: 'center', marginBottom: 12,
    },
    primaryBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
    skipBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
    skipText: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: colors.textSecondary },
  });
