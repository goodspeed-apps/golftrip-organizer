import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { scheduleLocalNotification } from '@/lib/notifications';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ChevronLeft, Trophy, Bell } from 'lucide-react-native';

const HANDICAP_OPTIONS = ['0-5', '6-12', '13-18', '19-24', '25+', "I don't track"];

export default function Step6Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();
  const [scoreTracking, setScoreTracking] = useState(true);
  const [handicap, setHandicap] = useState('13-18');
  const [notifRequested, setNotifRequested] = useState(false);

  useEffect(() => {
    track('onboarding_step_6', {});
    trackScreenLoad('onboarding_step6', start);
  }, []);

  async function handleEnableReminder() {
    track('onboarding_step_6_notif_request', {});
    try {
      await scheduleLocalNotification(
        'Round 1 finished? 🏌️',
        'Log your scores and check the trip leaderboard.',
        { seconds: 5 },
      );
      setNotifRequested(true);
    } catch (_) {
      setNotifRequested(true);
    }
  }

  async function handleContinue() {
    track('onboarding_step_6_continue', { score_tracking: scoreTracking, handicap_index: handicap });
    await saveOnboardingAnswers({ score_tracking: scoreTracking, handicap_index: handicap });
    router.push('/(auth)/onboarding/step-7');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ProgressBar current={6} total={7} />
      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={{ marginTop: 16, marginBottom: 24, alignSelf: 'flex-start', padding: 4, minHeight: 44, justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={{ alignItems: 'center', marginBottom: 28 }}>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: colors.warningMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Trophy size={34} color={colors.warning} />
          </View>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, textAlign: 'center', marginBottom: 8 }}>
            Track scores & compete
          </Text>
          <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            After each round, log scores and see the live leaderboard. {"It's the highlight of every trip."}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Your Handicap Index
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {HANDICAP_OPTIONS.map((opt) => {
              const isSelected = handicap === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setHandicap(opt)}
                  accessibilityLabel={`Handicap ${opt}`}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                    minHeight: 44,
                    justifyContent: 'center',
                  })}
                >
                  <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: isSelected ? colors.textOnPrimary : colors.text }}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleEnableReminder}
            accessibilityLabel="Enable score reminder notification"
            accessibilityHint="Sends you a reminder after your round to log scores"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: notifRequested ? colors.success : colors.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 14,
              opacity: pressed ? 0.8 : 1,
              minHeight: 60,
            })}
          >
            <Bell size={22} color={notifRequested ? colors.success : colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text }}>
                {notifRequested ? 'Reminder set ✓' : 'Remind me after each round'}
              </Text>
              <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary }}>
                {notifRequested ? "We'll nudge you to log scores" : 'One tap after your round'}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleContinue}
          accessibilityLabel="Continue to final step"
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            minHeight: 54,
          })}
        >
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary }}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
