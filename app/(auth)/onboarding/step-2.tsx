import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { Calendar } from 'lucide-react-native';
import { ProgressDots } from '@/components/onboarding/ProgressDots';

export default function Step2Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());

  const nextWeekend = getNextWeekend();
  const [tripName, setTripName] = useState('Golf Trip 2025');
  const [startDate, setStartDate] = useState(nextWeekend.start);
  const [endDate, setEndDate] = useState(nextWeekend.end);
  const [destination, setDestination] = useState('');

  useEffect(() => {
    track('onboarding_step_2');
    trackScreenLoad('onboarding_step2', startTime.current);
  }, []);

  const canContinue = tripName.trim().length > 0;

  const handleContinue = async () => {
    track('onboarding_step2_continue', { tripName, destination });
    await saveOnboardingAnswers({ tripName, tripStartDate: startDate, tripEndDate: endDate, courseDestination: destination });
    router.push('/(auth)/onboarding/step-3');
  };

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={s.back} testID="step-2-back">
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <ProgressDots total={7} current={2} colors={colors} />
        </View>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(500)} style={s.content}>
            <Text style={s.title}>{"Let's set up your trip"}</Text>
            <Text style={s.subtitle}>{"We've filled in some smart defaults, tweak anything you like."}</Text>
            <View style={s.field}>
              <Text style={s.label}>Trip Name</Text>
              <TextInput
                style={s.input}
                value={tripName}
                onChangeText={setTripName}
                placeholder="Golf Trip 2025"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Trip name input"
                testID="step-2-trip-name-input"
              />
            </View>
            <View style={s.row}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Start Date</Text>
                <View style={s.dateRow}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <TextInput
                    style={[s.input, { flex: 1, marginLeft: 6 }]}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel="Start date input"
                    testID="step-2-start-date-input"
                  />
                </View>
              </View>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>End Date</Text>
                <View style={s.dateRow}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <TextInput
                    style={[s.input, { flex: 1, marginLeft: 6 }]}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel="End date input"
                    testID="step-2-end-date-input"
                  />
                </View>
              </View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>{"Destination / Course (optional)"}</Text>
              <TextInput
                style={s.input}
                value={destination}
                onChangeText={setDestination}
                placeholder="e.g. Pinehurst, NC"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Destination input"
                testID="step-2-destination-input"
              />
            </View>
          </Animated.View>
        </ScrollView>
        <View style={s.footer}>
          <Pressable
            style={({ pressed }) => [s.primary, !canContinue && s.disabled, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityLabel="Continue to invite your group"
            testID="step-2-continue"
          >
            <Text style={s.primaryLabel}>Create Trip</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getNextWeekend() {
  const now = new Date();
  const day = now.getDay();
  const daysToFriday = (5 - day + 7) % 7 || 7;
  const start = new Date(now); start.setDate(now.getDate() + daysToFriday);
  const end = new Date(start); end.setDate(start.getDate() + 2);
  const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
  return { start: fmt(start), end: fmt(end) };
}

const styles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  back: { padding: 8 },
  backText: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary },
  scroll: { padding: 24, paddingBottom: 8 },
  content: { gap: 20 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: c.text },
  subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary, lineHeight: 22 },
  field: { gap: 6 },
  label: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: c.textSecondary },
  input: { borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.text, backgroundColor: c.surface },
  row: { flexDirection: 'row', gap: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.surface },
  footer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  primary: { backgroundColor: c.primary, borderRadius: 50, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: c.textOnPrimary },
  disabled: { opacity: 0.4 },
});
