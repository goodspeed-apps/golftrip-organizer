import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type RsvpStatus = 'coming' | 'pending' | 'declined';

interface Member {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
  rsvp_status: RsvpStatus;
  days_playing: string[];
  role: string;
}

interface Props {
  member: Member;
  isOrganizer: boolean;
  onRemove?: () => void;
}

const STATUS_CONFIG: Record<RsvpStatus, { label: string; colorKey: 'positive' | 'warning' | 'error' }> = {
  coming: { label: "Coming", colorKey: 'positive' },
  pending: { label: "Pending", colorKey: 'warning' },
  declined: { label: "Declined", colorKey: 'error' },
};

export default function MemberRow({ member, isOrganizer, onRemove }: Props) {
  const colors = useThemeColors();
  const cfg = STATUS_CONFIG[member.rsvp_status];
  const statusColor = colors[cfg.colorKey];
  const statusBg = cfg.colorKey === 'positive' ? colors.positiveMuted : cfg.colorKey === 'warning' ? colors.warningMuted : colors.negativeMuted;
  const initials = (member.display_name ?? 'G').slice(0, 2).toUpperCase();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.background, borderBottomWidth: 1, borderColor: colors.divider, minHeight: 64 }}>
      {member.avatar_url
        ? <Image source={{ uri: member.avatar_url }} style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12 }} />
        : (
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.primary }}>{initials}</Text>
          </View>
        )
      }
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text }}>{member.display_name ?? 'Guest'}</Text>
          {member.role === 'organizer' && (
            <View style={{ backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: colors.textOnPrimary }}>HOST</Text>
            </View>
          )}
        </View>
        {member.days_playing.length > 0 && (
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {member.days_playing.length} day{member.days_playing.length !== 1 ? 's' : ''} playing
          </Text>
        )}
      </View>
      <View style={{ backgroundColor: statusBg, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginRight: isOrganizer && onRemove ? 10 : 0 }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: statusColor }}>{cfg.label}</Text>
      </View>
      {isOrganizer && onRemove && (
        <Pressable
          onPress={onRemove}
          accessibilityLabel={`Remove ${member.display_name ?? 'member'}`}
          accessibilityHint="Removes this member from the trip"
          hitSlop={8}
          style={{ padding: 8 }}>
          <Trash2 size={18} color={colors.error} />
        </Pressable>
      )}
    </View>
  );
}
