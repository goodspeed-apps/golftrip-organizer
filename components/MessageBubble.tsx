import React from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

type Message = {
  id: string; body: string; created_at: string;
  guest_name: string | null; sender_display_name?: string; is_announcement: boolean;
};

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const colors = useThemeColors();
  const senderName = message.sender_display_name ?? message.guest_name ?? 'Guest';

  return (
    <View style={{ flexDirection: 'row', justifyContent: isOwn ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
      {!isOwn && (
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.primary }}>{initials(senderName)}</Text>
        </View>
      )}
      <View style={{ maxWidth: '75%' }}>
        {!isOwn && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textSecondary, marginBottom: 2, marginLeft: 4 }}>{senderName}</Text>}
        <View style={{ backgroundColor: isOwn ? colors.primary : colors.surfaceElevated, borderRadius: 16, borderBottomRightRadius: isOwn ? 4 : 16, borderBottomLeftRadius: isOwn ? 16 : 4, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: isOwn ? colors.textOnPrimary : colors.text, lineHeight: 21 }}>{message.body}</Text>
        </View>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: isOwn ? 'right' : 'left', marginHorizontal: 4 }}>{formatTime(message.created_at)}</Text>
      </View>
    </View>
  );
}
