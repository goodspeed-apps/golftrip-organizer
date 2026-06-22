import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ChevronRight, CheckCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, BorderRadius } from '@/lib/theme';
import type { TripWithMemberCount } from '@/types/golf';

type Props = {
  trip: TripWithMemberCount;
  onPress: () => void;
  onLongPress: () => void;
};

function formatYear(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function PastTripRow({ trip, onPress, onLongPress }: Props) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`Past trip: ${trip.name}`}
      accessibilityHint="Tap to view trip details"
      style={[styles.row, { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm }]}
    >
      <View style={[styles.dot, { backgroundColor: colors.primaryMuted }]}>
        <CheckCircle size={16} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{trip.name}</Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{formatYear(trip.start_date)}</Text>
      </View>
      <ChevronRight size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  name: { fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  date: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 },
});
