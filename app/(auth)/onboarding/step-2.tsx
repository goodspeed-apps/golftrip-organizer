import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ChevronLeft, MapPin, Calendar } from 'lucide-react-native';

function getDefaultTripName() {
  return `Golf Trip ${new Date().getFullYear()}`;
}

function nextFriday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function nextSunday() {
  const d = new Date(nextFriday());
  d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}

export default function Step2Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const start = Date.now();

  const [tripName, setTripName] = useState(getDefaultTripName());
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(nextFriday());
  const [endDate, setEndDate] = useState(nextSunday());

  useEffect(() => {
    track('onboarding_step_2');
    trackScreenLoad('onboarding_step2', start);
  }, []);

  const canContinue = tripName.trim().length > 0;

  async function handleContinue() {
    track('onboarding_step_2_continue', { trip_name: tripName, destination });
    await saveOnboardingAnswers({ trip_name: tripName, destination, trip_start: startDate, trip_end: endDate });
    router.push('/(auth)/onboarding/step-3');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ProgressBar current={2} total={7} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={{ marginBottom: 24, alignSelf: 'flex-start', padding: 4, minHeight: 44, justifyContent: 'center' }}>
            <ChevronLeft size={24} color={colors.textSecondary} />
          </Pressable>

          <Animated.View entering={FadeInDown.delay(0).duration(400)}>
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 28, color: colors.text, marginBottom: 8 }}>
              {"Let's build your trip"}
            </Text>
            <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 15, color: colors.textSecondary, marginBottom: 28, lineHeight: 22 }}>
              Give it a name and pick your dates. You can tweak everything later.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ gap: 20 }}>
            <View>
              <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Trip Name</Text>
              <TextInput
                value={tripName}
                onChangeText={setTripName}
                placeholder="Golf Trip 2025"
                placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Manrope_500Medium', fontSize: 16, color: colors.text, minHeight: 52 }}
                accessibilityLabel="Trip name"
              />
            </View>

            <View>
              <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Destination</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, minHeight: 52 }}>
                <MapPin size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  value={destination}
                  onChangeText={setDestination}
                  placeholder="Pebble Beach, Pinehurst..."
                  placeholderTextColor={colors.textMuted}
                  style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: colors.text, paddingVertical: 14 }}
                  accessibilityLabel="Destination"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Start</Text>
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 14, fontFamily: 'Manrope_500Medium', fontSize: 15, color: colors.text, minHeight: 52 }}
                  accessibilityLabel="Start date"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>End</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 14, fontFamily: 'Manrope_500Medium', fontSize: 15, color: colors.text, minHeight: 52 }}
                  accessibilityLabel="End date"
                />
              </View>
            </View>
          </Animated.View>

          <View style={{ flex: 1, minHeight: 32 }} />

          <Pressable
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityLabel="Continue to invite your group"
            style={({ pressed }) => ({
              backgroundColor: canContinue ? colors.primary : colors.border,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              minHeight: 54,
              marginTop: 16,
            })}
          >
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: canContinue ? colors.textOnPrimary : colors.textMuted }}>
              Continue
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
