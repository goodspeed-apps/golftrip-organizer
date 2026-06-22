import React from 'react';
import { Pressable, View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Calendar, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface Trip { id: string; name: string; start_date: string; status: string; role: string }
interface Props { trip: Trip; onPress: () => void }

const AnimPressable = Animated.createAnimatedComponent(Pressable);

export function ProfileTripCard({ trip, onPress }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const statusColor = trip.status === 'active' ? colors.success : trip.status === 'completed' ? colors.textMuted : colors.warning;

  return (
    <AnimPressable
      onPressIn={() => { scale.value = withSpring(0.97); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
      accessibilityLabel={`Trip: ${trip.name}`}
      accessibilityHint="Opens trip details"
      style={[style, { marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, minHeight: 64 }]}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor, marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text }}>{trip.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <Calendar size={12} color={colors.textSecondary} />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>{trip.start_date ? new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Date TBD'}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </AnimPressable>
  );
}
