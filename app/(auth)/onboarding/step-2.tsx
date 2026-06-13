import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { Calendar } from 'lucide-react-native';

export default function Step2Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());

  const nextWeekend = (() => {
    const d = new Date();
    const day = d.getDay();
    const toSat = (6 - day + 7) % 7 || 7;
    const sat = new Date(d); sat.setDate(d.getDate() + toSat);
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    return {
      start: sat.toISOString().slice(0, 10),
      end: sun.toISOString().slice(0, 10),
    };
  })();

  const [tripName, setTripName] = useState('Golf Trip 2025');
  const [startDate, setStartDate] = useState(nextWeekend.start);
  const [endDate, setEndDate] = useState(nextWeekend.end);
  const [course, setCourse] = useState('');

  useEffect(() => {
    track('onboarding_step_2');
    trackScreenLoad('onboarding_step2', startTime.current);
  }, []);

  const canContinue = tripName.trim().length > 0 && startDate.length === 10 && endDate.length === 10;

  const handleContinue = async () => {
    track('onboarding_step_2_continue', { trip_name: tripName, course });
    await saveOnboardingAnswers({ trip_name: tripName, trip_start: startDate, trip_end: endDate, trip_course: course });
    router.push('/(auth)/onboarding/step-3');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(500)}>
            <ProgressDots current={2} total={7} />
            <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
              <Text style={s.backText}>← Back</Text>
            </Pressable>
            <Text style={s.headline}>{"Name your trip"}</Text>
            <Text style={s.sub}>{"We've filled in some smart defaults, tweak anything you like."}</Text>

            {[
              { label: 'Trip Name', value: tripName, setter: setTripName, placeholder: 'Golf Trip 2025' },
              { label: 'Start Date', value: startDate, setter: setStartDate, placeholder: 'YYYY-MM-DD' },
              { label: 'End Date', value: endDate, setter: setEndDate, placeholder: 'YYYY-MM-DD' },
              { label: 'Course / Destination (optional)', value: course, setter: setCourse, placeholder: 'e.g. Pebble Beach' },
            ].map((field, i) => (
              <Animated.View key={field.label} entering={FadeInDown.delay(100 + i * 60).duration(400)} style={s.fieldWrap}>
                <Text style={s.label}>{field.label}</Text>
                <View style={s.inputRow}>
                  {field.label.includes('Date') && <Calendar size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />}
                  <TextInput
                    style={s.input}
                    value={field.value}
                    onChangeText={field.setter}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </Animated.View>
            ))}

            <Pressable
              style={[s.primaryBtn, !canContinue && s.disabled]}
              onPress={handleContinue}
              disabled={!canContinue}
              accessibilityLabel="Continue to next step"
            >
              <Text style={s.primaryBtnText}>Create Trip →</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 40 },
    back: { marginBottom: 20, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    backText: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.textSecondary },
    headline: { fontFamily: 'Outfit_700Bold', fontSize: 32, color: colors.text, marginBottom: 8 },
    sub: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, marginBottom: 28, lineHeight: 22 },
    fieldWrap: { marginBottom: 20 },
    label: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 12,
      paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border,
    },
    input: {
      flex: 1, fontFamily: 'Manrope_400Regular', fontSize: 16,
      color: colors.text, paddingVertical: 14,
    },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: 100,
      paddingVertical: 17, alignItems: 'center', marginTop: 12,
    },
    primaryBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
    disabled: { opacity: 0.45 },
  });
