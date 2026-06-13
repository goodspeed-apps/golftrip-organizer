import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ChevronLeft, CheckCircle, Eye, UserCheck } from 'lucide-react-native';

const MEMBER_STATES = [
  { id: '1', name: 'Jake M.', status: 'Joined ✓', joined: true },
  { id: '2', name: 'Priya S.', status: 'Viewing', joined: false },
  { id: '3', name: 'Chris T.', status: 'Invited', joined: false },
];

export default function Step4Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();
  const [guestAccess, setGuestAccess] = useState(true);

  useEffect(() => {
    track('onboarding_step_4');
    trackScreenLoad('onboarding_step4', start);
  }, []);

  async function handleContinue() {
    track('onboarding_step_4_continue', { guest_access: guestAccess });
    await saveOnboardingAnswers({ guest_access: guestAccess });
    router.push('/(auth)/onboarding/step-5');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ProgressBar current={4} total={7} />
      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={{ marginTop: 16, marginBottom: 24, alignSelf: 'flex-start', padding: 4, minHeight: 44, justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, marginBottom: 8 }}>
            Your group is joining
          </Text>
          <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, marginBottom: 24, lineHeight: 22 }}>
            Members see the full itinerary right away, no account required to view.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <FlatList
            data={MEMBER_STATES}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(80 + index * 60).duration(350)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, gap: 14 }}>
                  {item.joined
                    ? <CheckCircle size={22} color={colors.success} />
                    : <Eye size={22} color={colors.textMuted} />
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text }}>{item.name}</Text>
                    <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: item.joined ? colors.success : colors.textSecondary }}>{item.status}</Text>
                  </View>
                </View>
              </Animated.View>
            )}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: 24 }}>
          <Pressable
            onPress={() => { setGuestAccess(!guestAccess); track('onboarding_step_4_toggle_guest', { enabled: !guestAccess }); }}
            accessibilityLabel="Toggle guest access"
            accessibilityHint="Let people see the trip without an account"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: guestAccess ? colors.primary : colors.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 14,
              opacity: pressed ? 0.8 : 1,
              minHeight: 52,
            })}
          >
            <UserCheck size={22} color={guestAccess ? colors.primary : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text }}>Allow guest view</Text>
              <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: colors.textSecondary }}>{"Anyone with the link can see itinerary"}</Text>
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: guestAccess ? colors.primary : colors.border, backgroundColor: guestAccess ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {guestAccess && <CheckCircle size={14} color={colors.textOnPrimary} />}
            </View>
          </Pressable>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleContinue}
          accessibilityLabel="Continue to expenses"
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
