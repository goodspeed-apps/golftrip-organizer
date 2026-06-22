import React from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface MessageProps {
  message: {
    id: string;
    body: string;
    sender_member_id: string;
    guest_name: string | null;
    created_at: string;
    is_announcement: boolean;
    sender_display_name?: string;
  };
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageProps) {
  const colors = useThemeColors();
  const displayName = message.sender_display_name ?? message.guest_name ?? 'Member';
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      {!isOwn && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 6 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary }}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>{displayName}</Text>
        </View>
      )}
      <View style={{ maxWidth: '78%', backgroundColor: isOwn ? colors.primary : colors.surface, borderRadius: 18, borderBottomRightRadius: isOwn ? 4 : 18, borderBottomLeftRadius: isOwn ? 18 : 4, paddingHorizontal: 14, paddingVertical: 9, shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: isOwn ? colors.textOnPrimary : colors.text, lineHeight: 22 }}>{message.body}</Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: isOwn ? colors.textOnPrimary : colors.textSecondary, marginTop: 4, textAlign: isOwn ? 'right' : 'left', opacity: 0.75 }}>{time}</Text>
      </View>
    </View>
  );
}
