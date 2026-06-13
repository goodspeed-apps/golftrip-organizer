import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { Users } from 'lucide-react-native';

const SIZES = ['Just me', '2-4', '5-8', '9-12', '13+'];

export default function Step4Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    track('onboarding_step_4');
    trackScreenLoad('onboarding_step4', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_4_continue', { group_size: selected });
    await saveOnboardingAnswers({ group_size: selected ? SIZES.indexOf(selected) : 0, guest_access: true });
    router.push('/(auth)/onboarding/step-5');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View entering={FadeInDown.duration(500)} style={s.container}>
        <ProgressDots current={4} total={7} />
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>

        <Users size={36} color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={s.headline}>{"How big's the group?"}</Text>
        <Text style={s.sub}>{"Members get a guest view the moment they tap your link, no account needed. How many are you expecting?"}</Text>

        <FlatList
          data={SIZES}
          keyExtractor={(item) => item}
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const active = selected === item;
            return (
              <Animated.View entering={FadeInDown.delay(100 + index * 60).duration(400)}>
                <Pressable
                  style={[s.sizeChip, active && s.sizeChipActive]}
                  onPress={() => setSelected(item)}
                  accessibilityLabel={`Group size: ${item}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.sizeText, active && s.sizeTextActive]}>{item}</Text>
                </Pressable>
              </Animated.View>
            );
          }}
          contentContainerStyle={{ gap: 10, marginBottom: 32 }}
        />

        <Pressable
          style={s.primaryBtn}
          onPress={handleContinue}
          accessibilityLabel="Continue to next step"
        >
          <Text style={s.primaryBtnText}>Looks good →</Text>
        </Pressable>

        <Pressable style={s.skipBtn} onPress={handleContinue} accessibilityLabel="Skip this question">
          <Text style={s.skipText}>Skip</Text>
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
    sizeChip: {
      paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    sizeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sizeText: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, color: colors.text },
    sizeTextActive: { color: colors.textOnPrimary },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: 100,
      paddingVertical: 17, alignItems: 'center', marginBottom: 12,
    },
    primaryBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
    skipBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
    skipText: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: colors.textSecondary },
  });
