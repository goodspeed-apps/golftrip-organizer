import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { CheckCircle, ArrowRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface Settlement { id: string; from_member_id: string; to_member_id: string; amount_cents: number; is_paid: boolean; }
interface TripMember { id: string; user_id: string; guest_name?: string; role: string; }
interface Props { settlements: Settlement[]; members: TripMember[]; onMarkSettled: (id: string) => void; isOrganizer: boolean; }

function SettlementRow({ item, members, onMarkSettled, isOrganizer }: { item: Settlement; members: TripMember[]; onMarkSettled: (id: string) => void; isOrganizer: boolean }) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const from = members.find(m => m.id === item.from_member_id)?.guest_name ?? 'Someone';
  const to = members.find(m => m.id === item.to_member_id)?.guest_name ?? 'Someone';

  return (
    <Animated.View style={[animStyle, { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, opacity: item.is_paid ? 0.5 : 1 }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.text }}>{from}</Text>
          <ArrowRight size={14} color={colors.textSecondary} />
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.text }}>{to}</Text>
        </View>
        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary, marginTop: 2 }}>${((item.amount_cents ?? 0) / 100).toFixed(2)}</Text>
      </View>
      {item.is_paid ? (
        <CheckCircle size={22} color={colors.success} />
      ) : (
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={() => onMarkSettled(item.id)}
          accessibilityLabel={`Mark ${from} to ${to} as settled`}
          accessibilityHint="Records this balance as paid"
          style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primaryMuted, borderRadius: 8, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.primary }}>Settle</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export function SettlementCard({ settlements, members, onMarkSettled, isOrganizer }: Props) {
  const colors = useThemeColors();
  const unpaid = settlements.filter(s => !s.is_paid);
  const paid = settlements.filter(s => s.is_paid);

  return (
    <View style={{ margin: 16, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 12 }}>Settlements</Text>
      {unpaid.length === 0 && paid.length > 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <CheckCircle size={32} color={colors.success} />
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 8 }}>All balances are settled!</Text>
        </View>
      )}
      {[...unpaid, ...paid].map((item, index) => (
        <Animated.View key={item.id} entering={FadeInDown.delay(50 * index).duration(200)}>
          <SettlementRow item={item} members={members} onMarkSettled={onMarkSettled} isOrganizer={isOrganizer} />
          {index < settlements.length - 1 && <View style={{ height: 1, backgroundColor: colors.divider }} />}
        </Animated.View>
      ))}
    </View>
  );
}
