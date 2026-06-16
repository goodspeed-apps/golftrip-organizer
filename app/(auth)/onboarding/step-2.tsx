import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { MapPin, Calendar } from 'lucide-react-native';

function nextFriday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
function nextSunday(): string {
  const d = new Date(nextFriday());
  d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}

export default function Step2() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const year = new Date().getFullYear();

  const [tripName, setTripName] = useState(`Golf Trip ${year}`);
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(nextFriday());
  const [endDate, setEndDate] = useState(nextSunday());

  useEffect(() => {
    track('onboarding_step_2');
    trackScreenLoad('onboarding_step2', startTime.current);
  }, []);

  const canContinue = tripName.trim().length > 0;

  const handleContinue = async () => {
    track('onboarding_step_2_continue', { trip_name: tripName, destination });
    await saveOnboardingAnswers({ trip_name: tripName.trim(), destination: destination.trim(), trip_start: startDate, trip_end: endDate });
    router.push('/(auth)/onboarding/step-3');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back" accessibilityHint="Returns to the previous screen">
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <View style={s.progressBar}>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} style={[s.dot, i === 1 && s.dotActive, i === 0 && s.dotDone]} />
            ))}
          </View>
          <Text style={s.stepLabel}>Step 2 of 7</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(80).springify()} style={s.content}>
            <Text style={s.title}>{"Let's name your trip"}</Text>
            <Text style={s.subtitle}>{"We'll pre-fill some smart defaults, change anything you like."}</Text>

            <Text style={s.label}>Trip Name</Text>
            <TextInput
              style={s.input}
              value={tripName}
              onChangeText={setTripName}
              placeholder={`Golf Trip ${year}`}
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              accessibilityLabel="Trip name input"
            />

            <Text style={s.label}>Destination <Text style={s.optional}>(optional)</Text></Text>
            <View style={s.inputRow}>
              <MapPin size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                value={destination}
                onChangeText={setDestination}
                placeholder="Pebble Beach, Augusta..."
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                accessibilityLabel="Destination input"
              />
            </View>

            <View style={s.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Start Date</Text>
                <View style={s.dateChip}>
                  <Calendar size={14} color={colors.primary} />
                  <Text style={s.dateText}>{startDate}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>End Date</Text>
                <View style={s.dateChip}>
                  <Calendar size={14} color={colors.primary} />
                  <Text style={s.dateText}>{endDate}</Text>
                </View>
              </View>
            </View>
            <Text style={s.hint}>Tap a date to change it after account creation.</Text>
          </Animated.View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            style={({ pressed }) => [s.btnPrimary, !canContinue && s.btnDisabled, pressed && s.pressed]}
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityLabel="Continue to invite step"
          >
            <Text style={s.btnPrimaryText}>Continue</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    scroll: { padding: 24 },
    content: { gap: 4 },
    title: { fontSize: 28, fontFamily: 'Outfit_700Bold', color: colors.text, marginBottom: 6 },
    subtitle: { fontSize: 15, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, marginBottom: 20, lineHeight: 22 },
    label: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
    optional: { fontFamily: 'Manrope_400Regular', color: colors.textMuted },
    input: {
      backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
      borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 15, fontFamily: 'Manrope_400Regular', color: colors.text, marginBottom: 4,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
    dateRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    dateChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
      borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
    },
    dateText: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: colors.text },
    hint: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: colors.textMuted, marginTop: 8 },
    footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
    btnPrimaryText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textOnPrimary },
    btnDisabled: { opacity: 0.45 },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  });
