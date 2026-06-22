import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { DollarSign, Divide, Receipt } from 'lucide-react-native';
import { ProgressDots } from '@/components/onboarding/ProgressDots';

const EXPENSE_TYPES = [
  { key: 'green_fees', label: 'Green Fees', icon: '⛳' },
  { key: 'accommodation', label: 'Accommodation', icon: '🏨' },
  { key: 'food_drink', label: 'Food & Drinks', icon: '🍽' },
  { key: 'transport', label: 'Transport', icon: '🚗' },
];

export default function Step5Screen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [selected, setSelected] = React.useState<string>('green_fees');

  useEffect(() => {
    track('onboarding_step_5');
    trackScreenLoad('onboarding_step5', startTime.current);
  }, []);

  const handleContinue = async () => {
    track('onboarding_step5_continue', { expenseType: selected });
    await saveOnboardingAnswers({ firstExpenseType: selected });
    router.push('/(auth)/onboarding/step-6');
  };

  const s = styles(colors);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={s.back} testID="step-5-back">
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <ProgressDots total={7} current={5} colors={colors} />
        <View style={{ width: 60 }} />
      </View>
      <View style={s.container}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.content}>
          <View style={s.iconWrap}>
            <DollarSign size={36} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={s.title}>Split costs, zero drama</Text>
          <Text style={s.subtitle}>{"Log an expense and GolfTrip splits it instantly across your group. No more chasing Venmo."}</Text>
          <View style={s.mockExpense}>
            <View style={s.expenseHeader}>
              <Receipt size={18} color={colors.primary} />
              <Text style={s.expenseTitle}>Green Fees, Round 1</Text>
            </View>
            <Text style={s.expenseAmount}>$150.00</Text>
            <View style={s.divider} />
            <View style={s.splitRow}>
              <Divide size={16} color={colors.textSecondary} />
              <Text style={s.splitText}>8 players  →  <Text style={s.splitAmount}>$18.75 each</Text></Text>
            </View>
          </View>
          <Text style={s.pickLabel}>What expenses do you expect?</Text>
          <View style={s.chips}>
            {EXPENSE_TYPES.map(e => (
              <Pressable
                key={e.key}
                onPress={() => { setSelected(e.key); track('onboarding_expense_type_select', { type: e.key }); }}
                style={({ pressed }) => [s.chip, selected === e.key && s.chipActive, { opacity: pressed ? 0.8 : 1 }]}
                accessibilityLabel={`Select ${e.label}`}
                testID={`step-5-expense-${e.key}`}
              >
                <Text style={s.chipIcon}>{e.icon}</Text>
                <Text style={[s.chipLabel, selected === e.key && s.chipLabelActive]}>{e.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
        <Pressable
          style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={handleContinue}
          accessibilityLabel="Continue to score tracking"
          testID="step-5-continue"
        >
          <Text style={s.primaryLabel}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  back: { padding: 8 },
  backText: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, justifyContent: 'space-between' },
  content: { flex: 1, gap: 16, paddingTop: 8 },
  iconWrap: { width: 70, height: 70, borderRadius: 35, backgroundColor: c.primaryMuted, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: c.text },
  subtitle: { fontFamily: 'Manrope_400Regular', fontSize: 15, color: c.textSecondary, lineHeight: 22 },
  mockExpense: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: c.border, gap: 8 },
  expenseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expenseTitle: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.text, fontWeight: '600' },
  expenseAmount: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: c.text },
  divider: { height: 1, backgroundColor: c.border },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  splitText: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.textSecondary },
  splitAmount: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.primary, fontWeight: '700' },
  pickLabel: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 50, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
  chipActive: { borderColor: c.primary, backgroundColor: c.primaryMuted },
  chipIcon: { fontSize: 16 },
  chipLabel: { fontFamily: 'Manrope_400Regular', fontSize: 14, color: c.text },
  chipLabelActive: { color: c.primary, fontWeight: '600' },
  primary: { backgroundColor: c.primary, borderRadius: 50, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: c.textOnPrimary },
});
