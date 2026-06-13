import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { withSpring } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { MapPin } from 'lucide-react-native';

type TripRow = { id: string; name: string; start_date: string; end_date: string; status: string; role: string };

export function TripCard({ trip, onPress }: { trip: TripRow; onPress: () => void }) {
  const colors = useThemeColors();
  const badgeColor = trip.status === 'active' ? colors.success : trip.status === 'upcoming' ? colors.primary : colors.textSecondary;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return (
    <Pressable onPress={onPress} accessibilityLabel={`Trip: ${trip.name}`} accessibilityHint="View trip details"
      style={({ pressed }) => ({ marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text }} numberOfLines={1}>{trip.name}</Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{fmtDate(trip.start_date)}-{fmtDate(trip.end_date)}</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: colors.surfaceSecondary, marginLeft: 10 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: badgeColor, textTransform: 'capitalize' }}>{trip.status}</Text>
        </View>
      </View>
    </Pressable>
  );
}
