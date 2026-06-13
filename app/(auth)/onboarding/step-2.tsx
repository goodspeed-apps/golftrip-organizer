import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput,
  Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, MapPin, Calendar } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';

const STEP = 2;
const TOTAL = 7;

function nextWeekend() {
  const d = new Date();
  const day = d.getDay();
  const toFri = (5 - day + 7) % 7 || 7;
  const fri = new Date(d); fri.setDate(d.getDate() + toFri);
  const sun = new Date(fri); sun.setDate(fri.getDate() + 2);
  return {
    start: fri.toISOString().split('T')[0],
    end: sun.toISOString().split('T')[0],
  };
}

export default function Step2Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();

  const defaults = nextWeekend();
  const [tripName, setTripName] = useState('Golf Trip 2025');
  const [destination, setDestination] = useState('');
  const [tripStart, setTripStart] = useState(defaults.start);
  const [tripEnd, setTripEnd] = useState(defaults.end);

  useEffect(() => {
    track('onboarding_step_2');
    trackScreenLoad('OnboardingStep2', start);
  }, []);

  const canContinue = tripName.trim().length > 0;

  const handleContinue = async () => {
    track('onboarding_step_2_continue', { tripName, destination });
    await saveOnboardingAnswers({ tripName, destination, tripStart, tripEnd });
    router.push('/(auth)/onboarding/step-3');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}
            accessibilityLabel="Go back" accessibilityHint="Returns to welcome screen">
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <View style={s.progressRow}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[s.pip, i < STEP && s.pipActive]} />
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Text style={s.stepLabel}>Step {STEP} of {TOTAL}</Text>
            <Text style={s.title}>Name your trip</Text>
            <Text style={s.subtitle}>You can always change these details later, just get something down.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).springify()} style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>Trip Name</Text>
              <TextInput
                style={s.input}
                value={tripName}
                onChangeText={setTripName}
                placeholder="e.g. Myrtle Beach 2025"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Trip name input"
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}><MapPin size={14} color={colors.textSecondary} /> Destination (optional)</Text>
              <TextInput
                style={s.input}
                value={destination}
                onChangeText={setDestination}
                placeholder="e.g. Pebble Beach, CA"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Destination input"
              />
            </View>
            <View style={s.row}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}><Calendar size={14} color={colors.textSecondary} /> Start</Text>
                <TextInput
                  style={s.input}
                  value={tripStart}
                  onChangeText={setTripStart}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Trip start date"
                />
              </View>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>End</Text>
                <TextInput
                  style={s.input}
                  value={tripEnd}
                  onChangeText={setTripEnd}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Trip end date"
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue}
            style={({ pressed }) => [s.primary, !canContinue && s.disabled, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            accessibilityLabel="Continue to invite group"
          >
            <Text style={s.primaryText}>Create Trip →</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    progressRow: { flex: 1, flexDirection: 'row', gap: 6 },
    pip: { height: 4, flex: 1, borderRadius: 2, backgroundColor: colors.border },
    pipActive: { backgroundColor: colors.primary },
    scroll: { padding: 24, gap: 24 },
    stepLabel: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
    title: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: colors.text, marginBottom: 8 },
    subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    form: { gap: 16 },
    field: { gap: 6 },
    label: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: colors.textSecondary },
    input: {
      backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
      borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 13,
      fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.text,
    },
    row: { flexDirection: 'row', gap: 12 },
    footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 8 : 20 },
    primary: { backgroundColor: colors.primary, borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
    primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: colors.textOnPrimary },
    disabled: { opacity: 0.45 },
  });
