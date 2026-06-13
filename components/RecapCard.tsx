import React from 'react';
import { View, Text } from 'react-native';
import { Trophy, MapPin, DollarSign, Star, Lock } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface RecapData {
  tripName: string;
  startDate: string;
  endDate: string;
  courses: string[];
  winnerName: string;
  bestRoundScore: number | null;
  groupAvgScore: number | null;
  totalCostPerPersonCents: number | null;
  totalRounds: number;
  recapUnlocked: boolean;
}

interface Props {
  recap: RecapData;
  locked: boolean;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCents(cents: number | null) {
  if (cents == null) return ', ';
  return `$${((cents ?? 0) / 100).toFixed(0)}`;
}

export function RecapCard({ recap, locked }: Props) {
  const colors = useThemeColors();

  return (
    <View style={{
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: colors.card,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 20 }}>
        <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>{recap.tripName}</Text>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.primaryMuted, marginTop: 4 }}>
          {formatDate(recap.startDate)}-{formatDate(recap.endDate)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
          <MapPin size={14} color={colors.textOnPrimary} />
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textOnPrimary }} numberOfLines={1}>
            {recap.courses.length > 0 ? recap.courses.join(' · ') : 'No courses recorded'}
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatTile icon={<Trophy size={18} color={colors.warning} />} label="Winner" value={locked ? '•••' : recap.winnerName} colors={colors} />
          <StatTile icon={<Star size={18} color={colors.accent} />} label="Best Round" value={locked ? '•••' : (recap.bestRoundScore != null ? String(recap.bestRoundScore) : ', ')} colors={colors} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatTile icon={<MapPin size={18} color={colors.secondary} />} label="Total Rounds" value={locked ? '•••' : String(recap.totalRounds)} colors={colors} />
          <StatTile icon={<DollarSign size={18} color={colors.success} />} label="Per Person" value={locked ? '•••' : formatCents(recap.totalCostPerPersonCents)} colors={colors} />
        </View>
        {locked && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: colors.warningMuted, borderRadius: 10 }}>
            <Lock size={16} color={colors.warning} />
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.warning }}>
              Unlock to reveal full recap
            </Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center' }}>
          Avg Score: {locked ? ', ' : ((recap.groupAvgScore ?? 0).toFixed(1))} · Made with GolfTrip Organizer 🏌️
        </Text>
      </View>
    </View>
  );
}

function StatTile({ icon, label, value, colors }: { icon: React.ReactNode; label: string; value: string; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 14, gap: 6 }}>
      {icon}
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{value}</Text>
    </View>
  );
}
