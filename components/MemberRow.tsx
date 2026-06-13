import React, { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Trash2, Calendar } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type RsvpStatus = 'coming' | 'pending' | 'declined';

interface Member {
  id: string;
  display_name: string | null;
  guest_name: string | null;
  avatar_url: string | null;
  rsvp_status: RsvpStatus;
  days_playing: string[];
  role: string;
}

interface Props {
  member: Member;
  isOrganizer: boolean;
  isMe: boolean;
  onRsvpToggle: () => void;
  onRemove: () => void;
}

const STATUS_COLORS: Record<RsvpStatus, { bg: string; text: string }> = {
  coming: { bg: '#10B981', text: '#fff' },
  pending: { bg: '#F59E0B', text: '#fff' },
  declined: { bg: '#EF4444', text: '#fff' },
};

const STATUS_LABEL: Record<RsvpStatus, string> = { coming: 'Coming', pending: 'Pending', declined: "Can't Make It" };

export function MemberRow({ member, isOrganizer, isMe, onRsvpToggle, onRemove }: Props) {
  const colors = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const name = member.display_name ?? member.guest_name ?? 'Guest';
  const initials = name.slice(0, 2).toUpperCase();

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(pressed ? 0.95 : 1) }] }));
  const statusC = STATUS_COLORS[member.rsvp_status];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.divider, minHeight: 60 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' }}>
        {member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={{ width: 40, height: 40 }} /> : <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.primary }}>{initials}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text }}>{name}{member.role === 'organizer' ? ' 👑' : ''}</Text>
        {member.days_playing.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
            <Calendar size={11} color={colors.textSecondary} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary }}>{member.days_playing.length} day{member.days_playing.length !== 1 ? 's' : ''} playing</Text>
          </View>
        )}
      </View>
      {isMe ? (
        <Animated.View style={pillStyle}>
          <Pressable
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            onPress={onRsvpToggle}
            accessibilityLabel={`Your RSVP: ${STATUS_LABEL[member.rsvp_status]}`}
            accessibilityHint="Tap to change your RSVP status"
            style={{ backgroundColor: statusC.bg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: statusC.text }}>{STATUS_LABEL[member.rsvp_status]}</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <View style={{ backgroundColor: statusC.bg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: statusC.text }}>{STATUS_LABEL[member.rsvp_status]}</Text>
        </View>
      )}
      {isOrganizer && !isMe && (
        <Pressable onPress={onRemove} accessibilityLabel="Remove member" accessibilityHint="Removes this member from the trip" style={{ marginLeft: 10, padding: 8 }}>
          <Trash2 size={18} color={colors.error} />
        </Pressable>
      )}
    </View>
  );
}
