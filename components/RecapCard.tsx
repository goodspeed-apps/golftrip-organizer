import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Trophy, Star, DollarSign, Flag, BarChart2 } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface RecapData {
  tripName: string;
  startDate: string;
  endDate: string;
  courses: string[];
  winnerName: string;
  bestRoundScore: number | null;
  groupAvgScore: number | null;
  totalCostPerPerson: number | null;
  totalRounds: number;
  recapUnlocked: boolean;
}

interface Props {
  recap: RecapData;
  blurred?: boolean;
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 12, minWidth: 80 }}>
      {icon}
      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginTop: 6 }}>{value}</Text>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

export function RecapCard({ recap, blurred = false }: Props) {
  const colors = useThemeColors();
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const costStr = recap.totalCostPerPerson != null ? `$${((recap.totalCostPerPerson) / 100).toFixed(0)}` : 'N/A';
  const bestStr = recap.bestRoundScore != null ? String(recap.bestRoundScore) : 'N/A';
  const avgStr = recap.groupAvgScore != null ? (recap.groupAvgScore ?? 0).toFixed(1) : 'N/A';

  return (
    <Animated.View
      entering={FadeInDown.delay(80)}
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.borderAccent,
        opacity: blurred ? 0.4 : 1,
      }}
    >
      <View style={{ padding: 20, backgroundColor: colors.primary, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textOnPrimary, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8 }}>Golf Trip Recap</Text>
        <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary, marginTop: 4 }}>{recap.tripName}</Text>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textOnPrimary, marginTop: 4, opacity: 0.9 }}>{fmt(recap.startDate)}-{fmt(recap.endDate)}</Text>
      </View>

      <View style={{ padding: 16 }}>
        {recap.courses.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Courses Played</Text>
            {recap.courses.map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Flag size={12} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.text }}>{c}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <StatCell icon={<Trophy size={18} color={colors.warning} />} label="Winner" value={recap.winnerName.split(' ')[0]} />
          <StatCell icon={<Star size={18} color={colors.accent} />} label="Best Round" value={bestStr} />
          <StatCell icon={<BarChart2 size={18} color={colors.primary} />} label="Group Avg" value={avgStr} />
          <StatCell icon={<DollarSign size={18} color={colors.success} />} label="Per Person" value={costStr} />
        </View>

        <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Flag size={12} color={colors.textMuted} />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted }}>{recap.totalRounds} round{recap.totalRounds !== 1 ? 's' : ''} played</Text>
        </View>
      </View>
    </Animated.View>
  );
}
