import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { User } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type Props = {
  user: { id: string; email?: string; user_metadata?: { display_name?: string; avatar_url?: string; handicap?: number } } | null;
  stats: { totalTrips: number; roundsPlayed: number; avgScore: number | null; yoyDelta: number | null };
};

const StatBox = ({ label, value }: { label: string; value: string }) => {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingVertical: 12, marginHorizontal: 4, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text }}>{value}</Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
};

export function ProfileHeader({ user, stats }: Props) {
  const colors = useThemeColors();
  const meta = user?.user_metadata ?? {};
  const name = meta.display_name ?? user?.email ?? 'Golfer';
  const avatar = meta.avatar_url;
  const handicap = meta.handicap ?? null;

  return (
    <Animated.View entering={FadeInDown.springify()} style={{ marginBottom: 18 }}>
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary, overflow: 'hidden', marginBottom: 10 }}>
          {avatar ? <Image source={{ uri: avatar }} style={{ width: 80, height: 80 }} /> : <User size={36} color={colors.primary} />}
        </View>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: colors.text }}>{name}</Text>
        {handicap !== null && (
          <View style={{ marginTop: 6, backgroundColor: colors.primaryMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.primary }}>HCP {(handicap ?? 0).toFixed(1)}</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <StatBox label="Trips" value={String(stats.totalTrips)} />
        <StatBox label="Rounds" value={String(stats.roundsPlayed)} />
        <StatBox label="Avg Score" value={stats.avgScore != null ? (stats.avgScore ?? 0).toFixed(1) : ', '} />
      </View>
      {stats.yoyDelta !== null && (
        <View style={{ backgroundColor: stats.yoyDelta <= 0 ? colors.positiveMuted : colors.warningMuted, borderRadius: 12, padding: 12, marginBottom: 4 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: stats.yoyDelta <= 0 ? colors.positive : colors.warning, textAlign: 'center' }}>
            {stats.yoyDelta <= 0 ? `Your group shot ${Math.abs(stats.yoyDelta).toFixed(1)} strokes better this year 🏌️` : `Your group shot ${(stats.yoyDelta ?? 0).toFixed(1)} strokes more this year`}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
