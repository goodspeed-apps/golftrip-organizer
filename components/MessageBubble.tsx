import React from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

type Message = { id: string; body: string; created_at: string; sender_member_id: string; guest_name: string | null; };

export function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start', marginVertical: 2 }}>
      {!isOwn && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 2, marginLeft: 4 }}>{message.guest_name ?? 'Member'}</Text>}
      <Animated.View style={[animStyle, { maxWidth: '78%', backgroundColor: isOwn ? colors.primary : colors.surfaceElevated, borderRadius: 18, borderBottomRightRadius: isOwn ? 4 : 18, borderBottomLeftRadius: isOwn ? 18 : 4, paddingHorizontal: 14, paddingVertical: 10 }]}>
        <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: isOwn ? colors.textOnPrimary : colors.text, lineHeight: 21 }}>{message.body}</Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: isOwn ? colors.primaryMuted : colors.textSecondary, marginTop: 4, textAlign: 'right' }}>{time}</Text>
      </Animated.View>
    </View>
  );
}
