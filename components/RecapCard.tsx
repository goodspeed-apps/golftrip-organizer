import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Crown, Star, MapPin, Calendar, DollarSign } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type RecapData = {
  tripName: string;
  startDate: string;
  endDate: string;
  courses: string[];
  winnerName: string;
  bestScore: number;
  groupAvg: number;
  costPerPerson: number;
  recapUnlocked: boolean;
};

type Props = { recap: RecapData; blurred?: boolean };

export function RecapCard({ recap, blurred = false }: Props) {
  const colors = useThemeColors();

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ', ';

  const stats = [
    { icon: <Crown size={18} color={colors.warning} />, label: 'Winner', value: recap.winnerName },
    { icon: <Star size={18} color={colors.accent} />, label: 'Best Round', value: (recap.bestScore ?? 0) > 0 ? String(recap.bestScore) : ', ' },
    { icon: <Star size={18} color={colors.textSecondary} />, label: 'Group Avg', value: (recap.groupAvg ?? 0) > 0 ? (recap.groupAvg ?? 0).toFixed(1) : ', ' },
    { icon: <DollarSign size={18} color={colors.success} />, label: 'Cost / Person', value: recap.costPerPerson > 0 ? `$${recap.costPerPerson.toFixed(0)}` : ', ' },
  ];

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={{
        borderRadius: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.borderAccent,
        overflow: 'hidden',
        opacity: blurred ? 0.35 : 1,
      }}
    >
      <View style={{ backgroundColor: colors.primary, padding: 20, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.textOnPrimary, textAlign: 'center' }}>{recap.tripName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
          <Calendar size={14} color={colors.textOnPrimary} />
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textOnPrimary }}>
            {fmt(recap.startDate)}-{fmt(recap.endDate)}
          </Text>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        {recap.courses.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MapPin size={14} color={colors.textSecondary} />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>Courses Played</Text>
            </View>
            {recap.courses.slice(0, 3).map((c, i) => (
              <Animated.View key={c} entering={FadeInDown.delay(50 * i)} style={{ paddingVertical: 4, borderBottomWidth: i < recap.courses.length - 1 ? 1 : 0, borderColor: colors.divider }}>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text }}>⛳ {c}</Text>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {stats.map((s, i) => (
            <Animated.View
              key={s.label}
              entering={FadeInDown.delay(50 * i)}
              style={{ flex: 1, minWidth: '44%', backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 }}
            >
              {s.icon}
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text }}>{s.value}</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted }}>{s.label}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}
