import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { UserMinus, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type RsvpStatus = 'coming' | 'pending' | 'declined';

interface MemberRowProps {
  member: { id: string; display_name: string; avatar_url: string | null; rsvp_status: RsvpStatus; days_playing: string[]; role: string };
  isOrganizer: boolean;
  isMe: boolean;
  onRsvpToggle: () => void;
  onRemove: () => void;
}

const STATUS_ICON = { coming: CheckCircle, pending: Clock, declined: XCircle };
const STATUS_NEXT_LABEL: Record<RsvpStatus, string> = { coming: 'Coming', pending: 'Unsure', declined: "Can't Make It" };

export function MemberRow({ member, isOrganizer, isMe, onRsvpToggle, onRemove }: MemberRowProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const statusColors: Record<RsvpStatus, string> = {
    coming: colors.success,
    pending: colors.warning,
    declined: colors.error,
  };
  const statusBgColors: Record<RsvpStatus, string> = {
    coming: colors.positiveMuted,
    pending: colors.warningMuted,
    declined: colors.negativeMuted,
  };

  const Icon = STATUS_ICON[member.rsvp_status];
  const pillColor = statusColors[member.rsvp_status];
  const pillBg = statusBgColors[member.rsvp_status];

  return (
    <Animated.View style={[animStyle, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 }]}>
      {member.avatar_url
        ? <Image source={{ uri: member.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
        : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 16 }}>{member.display_name.charAt(0).toUpperCase()}</Text>
          </View>
      }
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>
          {member.display_name}{member.role === 'organizer' ? '  👑' : ''}{isMe ? ' (You)' : ''}
        </Text>
        {member.days_playing.length > 0 && (
          <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }}>
            Playing {member.days_playing.length} day{member.days_playing.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
      {isMe ? (
        <Pressable
          onPress={() => { scale.value = withSpring(0.97, { damping: 15 }, () => { scale.value = withSpring(1); }); onRsvpToggle(); }}
          accessibilityLabel={`Your RSVP is ${member.rsvp_status}`}
          accessibilityHint="Tap to change your RSVP status"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: pillBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, minWidth: 44, minHeight: 44, justifyContent: 'center' }}
        >
          <Icon size={14} color={pillColor} />
          <Text style={{ color: pillColor, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{STATUS_NEXT_LABEL[member.rsvp_status]}</Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: pillBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Icon size={14} color={pillColor} />
          <Text style={{ color: pillColor, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{STATUS_NEXT_LABEL[member.rsvp_status]}</Text>
        </View>
      )}
      {isOrganizer && !isMe && (
        <Pressable
          onPress={onRemove}
          accessibilityLabel={`Remove ${member.display_name}`}
          accessibilityHint="Removes this member from the trip"
          style={{ padding: 10, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <UserMinus size={18} color={colors.error} />
        </Pressable>
      )}
    </Animated.View>
  );
}
