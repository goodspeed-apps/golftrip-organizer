import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { UserCheck, Globe, Bell } from 'lucide-react-native';

const RSVP_OPTIONS = [
  { key: 'one_tap', label: 'One-tap RSVP', desc: "Members just tap, I'm In or I'm Out.", icon: UserCheck },
  { key: 'view_only', label: 'View-only guests', desc: 'They see the plan, no account needed.', icon: Globe },
  { key: 'notify_me', label: 'Notify me when they join', desc: "I'll get a ping when someone RSVPs.", icon: Bell },
];

export default function Step4() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [selected, setSelected] = useState<string>('one_tap');

  useEffect(() => {
    track('onboarding_step_4');
    trackScreenLoad('onboarding_step4', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_4_continue', { rsvp_style: selected });
    await saveOnboardingAnswers({ rsvp_style: selected });
    router.push('/(auth)/onboarding/step-5');
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
            <View key={i} style={[s.dot, i === 3 && s.dotActive, i < 3 && s.dotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>Step 4 of 7</Text>
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={s.content}>
        <Text style={s.title}>How do you want your group to join?</Text>
        <Text style={s.subtitle}>{"They get the full itinerary the moment they tap your link. Pick how RSVPs work."}</Text>

        <FlatList
          data={RSVP_OPTIONS}
          keyExtractor={(item) => item.key}
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const Icon = item.icon;
            const isSelected = selected === item.key;
            return (
              <Animated.View entering={FadeInDown.delay(100 + index * 50).springify()}>
                <Pressable
                  style={({ pressed }) => [s.optionCard, isSelected && s.optionCardSelected, pressed && s.pressed]}
                  onPress={() => setSelected(item.key)}
                  accessibilityLabel={item.label}
                  accessibilityHint={item.desc}
                >
                  <View style={[s.optionIcon, isSelected && s.optionIconSelected]}>
                    <Icon size={20} color={isSelected ? colors.textOnPrimary : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>{item.label}</Text>
                    <Text style={s.optionDesc}>{item.desc}</Text>
                  </View>
                  {isSelected && <View style={s.checkDot} />}
                </Pressable>
              </Animated.View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </Animated.View>

      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [s.btnPrimary, pressed && s.pressed]}
          onPress={handleContinue}
          accessibilityLabel="Continue to expenses step"
        >
          <Text style={s.btnPrimaryText}>Continue</Text>
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
    title: { fontSize: 26, fontFamily: 'Outfit_700Bold', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 15, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, lineHeight: 22, marginBottom: 24 },
    optionCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      borderWidth: 1.5, borderColor: colors.border,
    },
    optionCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
    optionIcon: {
      width: 42, height: 42, borderRadius: 12,
      backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center',
    },
    optionIconSelected: { backgroundColor: colors.primary },
    optionLabel: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: colors.text, marginBottom: 2 },
    optionLabelSelected: { color: colors.primary },
    optionDesc: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: colors.textSecondary },
    checkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    footer: { paddingHorizontal: 24, paddingBottom: 24 },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
    btnPrimaryText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textOnPrimary },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  });
