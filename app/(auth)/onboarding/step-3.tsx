import React, { useEffect } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ChevronLeft, Link, MessageSquare, Mail, Users } from 'lucide-react-native';

const INVITE_LINK = 'https://golftrip.app/join/DEMO2025';

export default function Step3Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();

  useEffect(() => {
    track('onboarding_step_3');
    trackScreenLoad('onboarding_step3', start);
  }, []);

  async function handleShareLink() {
    track('onboarding_step_3_share', { method: 'native_share' });
    await saveOnboardingAnswers({ invite_method: 'native_share' });
    try {
      await Share.share({ message: `Join my golf trip! ${INVITE_LINK}`, url: INVITE_LINK });
    } catch (_) {}
  }

  async function handleContinue() {
    track('onboarding_step_3_continue');
    await saveOnboardingAnswers({ invite_method: 'skipped' });
    router.push('/(auth)/onboarding/step-4');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ProgressBar current={3} total={7} />
      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={{ marginTop: 16, marginBottom: 24, alignSelf: 'flex-start', padding: 4, minHeight: 44, justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Users size={36} color={colors.primary} />
            </View>
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, textAlign: 'center', marginBottom: 10 }}>
              Your trip is ready! 🎉
            </Text>
            <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
              {"Share this link and your group can see the full itinerary instantly, no account needed."}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ gap: 14 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Link size={18} color={colors.primary} />
            <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 14, color: colors.text }} numberOfLines={1}>{INVITE_LINK}</Text>
          </View>

          <Pressable
            onPress={handleShareLink}
            accessibilityLabel="Share trip link with your group"
            accessibilityHint="Opens the native share sheet"
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
              minHeight: 54,
            })}
          >
            <MessageSquare size={20} color={colors.textOnPrimary} />
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary }}>Share with Group</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { icon: MessageSquare, label: 'Text' },
              { icon: Mail, label: 'Email' },
            ].map(({ icon: Icon, label }) => (
              <Pressable
                key={label}
                onPress={handleShareLink}
                accessibilityLabel={`Share via ${label}`}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: pressed ? 0.8 : 1,
                  minHeight: 52,
                })}
              >
                <Icon size={18} color={colors.primary} />
                <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleContinue}
          accessibilityLabel="Continue"
          style={({ pressed }) => ({
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
            minHeight: 48,
          })}
        >
          <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 15, color: colors.textSecondary }}>
            {"I'll invite them later"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
