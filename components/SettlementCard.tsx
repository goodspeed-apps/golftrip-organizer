import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, useSharedValue, withSpring } from 'react-native-reanimated';
import { CheckCircle, CreditCard } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type TripMember = { id: string; user_id: string | null; guest_name: string | null; role: string; };
type Settlement = { id: string; from_member_id: string; to_member_id: string; amount_cents: number; is_paid: boolean; venmo_deeplink: string | null; paypal_deeplink: string | null; };
interface Props { settlements: Settlement[]; members: TripMember[]; isOrganizer: boolean; onMarkSettled: (id: string) => void; onPayPress: () => void; }

function memberName(members: TripMember[], id: string) {
  return members.find(m => m.id === id)?.guest_name ?? 'Member';
}

export function SettlementCard({ settlements, members, isOrganizer, onMarkSettled, onPayPress }: Props) {
  const colors = useThemeColors();
  const pending = settlements.filter(s => !s.is_paid);
  const paid = settlements.filter(s => s.is_paid);

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(350)}
      style={{ margin: 16, borderRadius: 16, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border, padding: 16,
        shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3, marginBottom: 96 }}>
      <Text style={{ color: colors.text, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, marginBottom: 12 }}>Settlements</Text>
      {pending.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <CheckCircle size={32} color={colors.success} />
          <Text style={{ color: colors.success, fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 8 }}>All settled up! 🎉</Text>
        </View>
      )}
      {pending.map((s, i) => {
        const scale = useSharedValue(1);
        return (
          <Animated.View key={s.id} entering={FadeInDown.delay(60 * i).duration(280)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 10, borderBottomWidth: i < pending.length - 1 ? 1 : 0, borderBottomColor: colors.divider }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
                {memberName(members, s.from_member_id)}
                <Text style={{ color: colors.textSecondary }}>{' owes '}</Text>
                {memberName(members, s.to_member_id)}
              </Text>
              <Text style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, marginTop: 2 }}>
                ${((s.amount_cents ?? 0) / 100).toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={onPayPress}
                onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
                onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
                accessibilityLabel="Pay online" accessibilityHint="Opens in-app payment options"
                style={{ padding: 8, borderRadius: 10, backgroundColor: colors.secondaryMuted, minHeight: 44, justifyContent: 'center' }}>
                <CreditCard size={18} color={colors.secondary} />
              </Pressable>
              {isOrganizer && (
                <Pressable onPress={() => onMarkSettled(s.id)}
                  accessibilityLabel="Mark as settled" accessibilityHint="Marks this balance as paid"
                  style={{ paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.success, minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ color: colors.textOnPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Settled</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        );
      })}
      {paid.length > 0 && (
        <Text style={{ color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 10 }}>{paid.length} balance{paid.length > 1 ? 's' : ''} already settled</Text>
      )}
    </Animated.View>
  );
}
