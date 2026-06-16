import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronRight, Flag } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, BorderRadius } from '@/lib/theme';

const spacing = Spacing;
const radii = BorderRadius;

interface Trip {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Props {
  trip: Trip;
  onPress: () => void;
  onLongPress: () => void;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${e.toLocaleDateString('en-US', opts)}`;
}

export function PastTripRow({ trip, onPress, onLongPress }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`Past trip: ${trip.name}`}
      accessibilityHint="Tap to view, long-press for options"
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={styles.iconWrap}>
        <Flag size={18} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{trip.name}</Text>
        <Text style={styles.dates}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
    iconWrap: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1 },
    name: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: colors.text },
    dates: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  });
