import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { DollarSign, Users, CreditCard, Divide } from 'lucide-react-native';

const SPLIT_OPTIONS = [
  { key: 'equal', label: 'Split equally', desc: 'Everyone pays the same share.', icon: Divide },
  { key: 'itemized', label: 'Itemized by person', desc: 'Assign specific items to specific people.', icon: Users },
  { key: 'organizer_pays', label: 'Organizer pays, group settles', desc: "I'll front costs and collect later.", icon: CreditCard },
];

const EXAMPLE_EXPENSES = [
  { label: 'Green fees (4 players)', amount: 600, per: 150 },
  { label: 'Golf cart rental', amount: 80, per: 20 },
  { label: 'Dinner reservation', amount: 240, per: 60 },
];

export default function Step5() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [splitStyle, setSplitStyle] = useState<string>('equal');

  useEffect(() => {
    track('onboarding_step_5');
    trackScreenLoad('onboarding_step5', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_5_continue', { expense_split: splitStyle });
    await saveOnboardingAnswers({ expense_split: splitStyle });
    router.push('/(auth)/onboarding/step-6');
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
            <View key={i} style={[s.dot, i === 4 && s.dotActive, i < 4 && s.dotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>Step 5 of 7</Text>
      </View>

      <FlatList
        data={SPLIT_OPTIONS}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.delay(80).springify()} style={s.listHeader}>
            <Text style={s.title}>Who pays for what?</Text>
            <Text style={s.subtitle}>{"Add a $150 green fee and watch it split automatically, no calculator needed."}</Text>

            <View style={s.previewCard}>
              <View style={s.previewHeader}>
                <DollarSign size={16} color={colors.accent} />
                <Text style={s.previewTitle}>Expense Preview</Text>
                <Text style={s.previewTotal}>$920 total</Text>
              </View>
              {EXAMPLE_EXPENSES.map((e) => (
                <View key={e.label} style={s.expenseRow}>
                  <Text style={s.expenseLabel}>{e.label}</Text>
                  <Text style={s.expenseAmt}>${(e.per ?? 0).toFixed(0)}<Text style={s.perPerson}>/person</Text></Text>
                </View>
              ))}
            </View>

            <Text style={s.sectionLabel}>Your preferred split method</Text>
          </Animated.View>
        }
        renderItem={({ item, index }) => {
          const Icon = item.icon;
          const isSelected = splitStyle === item.key;
          return (
            <Animated.View entering={FadeInDown.delay(160 + index * 50).springify()} style={{ paddingHorizontal: 24, marginBottom: 10 }}>
              <Pressable
                style={({ pressed }) => [s.optionCard, isSelected && s.optionCardSelected, pressed && s.pressed]}
                onPress={() => setSplitStyle(item.key)}
                accessibilityLabel={item.label}
                accessibilityHint={item.desc}
              >
                <View style={[s.optionIcon, isSelected && s.optionIconSelected]}>
                  <Icon size={18} color={isSelected ? colors.textOnPrimary : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>{item.label}</Text>
                  <Text style={s.optionDesc}>{item.desc}</Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />

      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [s.btnPrimary, pressed && s.pressed]}
          onPress={handleContinue}
          accessibilityLabel="Continue to score tracking step"
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
    listHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
    title: { fontSize: 26, fontFamily: 'Outfit_700Bold', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 15, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, lineHeight: 22, marginBottom: 20 },
    previewCard: {
      backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1,
      borderColor: colors.border, padding: 16, marginBottom: 24,
    },
    previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    previewTitle: { flex: 1, fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: colors.text },
    previewTotal: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.accent },
    expenseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    expenseLabel: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: colors.textSecondary, flex: 1 },
    expenseAmt: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: colors.text },
    perPerson: { fontSize: 11, fontFamily: 'Manrope_400Regular', color: colors.textMuted },
    sectionLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
    optionCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.surface, borderRadius: 16, padding: 14,
      borderWidth: 1.5, borderColor: colors.border,
    },
    optionCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
    optionIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    optionIconSelected: { backgroundColor: colors.primary },
    optionLabel: { fontSize: 15, fontFamily: 'Manrope_600SemiBold', color: colors.text, marginBottom: 2 },
    optionLabelSelected: { color: colors.primary },
    optionDesc: { fontSize: 13, fontFamily: 'Manrope_400Regular', color: colors.textSecondary },
    footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
    btnPrimaryText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textOnPrimary },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  });
