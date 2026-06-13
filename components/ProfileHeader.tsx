import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

type Props = {
  user: { display_name?: string; avatar_url?: string; handicap?: number | null; email?: string } | null;
  stats: { totalTrips: number; roundsPlayed: number; avgScore: number | null };
};

export function ProfileHeader({ user, stats }: Props) {
  const colors = useThemeColors();
  const initials = (user?.display_name ?? user?.email ?? 'G').slice(0, 2).toUpperCase();
  return (
    <Animated.View entering={FadeInDown} style={{ alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: colors.primary }}>
        {user?.avatar_url ? <Image source={{ uri: user.avatar_url }} style={{ width: 80, height: 80 }} /> : <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, color: colors.primary }}>{initials}</Text>}
      </View>
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: colors.text, marginTop: 10 }}>{user?.display_name ?? 'Golfer'}</Text>
      {user?.handicap != null && (
        <View style={{ marginTop: 6, paddingHorizontal: 12, paddingVertical: 3, backgroundColor: colors.accent, borderRadius: 20 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textOnPrimary }}>HCP {(user.handicap ?? 0).toFixed(1)}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', marginTop: 18, gap: 24 }}>
        {[{ label: 'Trips', value: stats.totalTrips }, { label: 'Rounds', value: stats.roundsPlayed }, { label: 'Avg Score', value: stats.avgScore != null ? (stats.avgScore ?? 0).toFixed(1) : ', ' }].map(s => (
          <View key={s.label} style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.primary }}>{String(s.value)}</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
