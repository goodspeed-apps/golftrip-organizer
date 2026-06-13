import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, Alert,
  RefreshControl, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { UserPlus, Copy, Share2 } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { MemberRow } from '@/components/MemberRow';

type RsvpStatus = 'coming' | 'pending' | 'declined';

interface Member {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  role: string;
  rsvp_status: RsvpStatus;
  days_playing: string[];
  display_name: string | null;
  avatar_url: string | null;
}

const STATUS_ORDER: RsvpStatus[] = ['coming', 'pending', 'declined'];
const STATUS_LABEL: Record<RsvpStatus, string> = { coming: 'Coming', pending: 'Pending', declined: "Can't Make It" };

export default function MembersScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { showToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const start = Date.now();

  const fetchMembers = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    const end = trackApiLatency('fetch_trip_members');
    try {
      const [{ data: trip }, { data: rows }] = await Promise.all([
        supabase.from('trips').select('organizer_id, invite_code').eq('id', id).single(),
        supabase.from('trip_members').select('id, user_id, guest_name, guest_email, role, rsvp_status, days_playing, users:user_id(display_name, avatar_url)').eq('trip_id', id),
      ]);
      if (trip) {
        setInviteCode(trip.invite_code ?? '');
        setIsOrganizer(trip.organizer_id === user?.id);
      }
      const mapped: Member[] = (rows ?? []).map((r: Record<string, unknown>) => {
        const u = r.users as { display_name: string | null; avatar_url: string | null } | null;
        return { id: r.id as string, user_id: r.user_id as string | null, guest_name: r.guest_name as string | null, guest_email: r.guest_email as string | null, role: r.role as string, rsvp_status: (r.rsvp_status as RsvpStatus) ?? 'pending', days_playing: (r.days_playing as string[]) ?? [], display_name: u?.display_name ?? null, avatar_url: u?.avatar_url ?? null };
      });
      setMembers(mapped);
      const mine = mapped.find(m => m.user_id === user?.id);
      setMyMemberId(mine?.id ?? null);
      trackScreenLoad('members_rsvp', start);
    } catch (e) {
      captureException(e as Error, { screen: 'members_rsvp', action: 'fetch' });
    } finally {
      setLoading(false);
      setRefreshing(false);
      end();
    }
  }, [id, user?.id]);

  useEffect(() => { track('screen_view_members_rsvp', { trip_id: id }); fetchMembers(); }, []);

  const handleCopyLink = async () => {
    const link = `https://golftrip.app/join/${inviteCode}`;
    await Clipboard.setStringAsync(link);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Copied!');
    track('copy_invite_link', { trip_id: id });
    setTimeout(() => Share.share({ message: link }), 1500);
  };

  const handleRsvpToggle = async (memberId: string, current: RsvpStatus) => {
    const next: RsvpStatus = current === 'coming' ? 'declined' : current === 'declined' ? 'pending' : 'coming';
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, rsvp_status: next } : m));
    const { error } = await supabase.from('trip_members').update({ rsvp_status: next }).eq('id', memberId);
    if (error) { captureException(error, { screen: 'members_rsvp', action: 'rsvp_toggle' }); fetchMembers(); }
    track('rsvp_status_changed', { trip_id: id, new_status: next });
  };

  const handleRemove = (memberId: string) => {
    Alert.alert('Remove Member', 'Are you sure you want to remove this member?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('trip_members').delete().eq('id', memberId);
        if (error) captureException(error, { screen: 'members_rsvp', action: 'remove_member' });
        else { setMembers(prev => prev.filter(m => m.id !== memberId)); track('member_removed', { trip_id: id }); }
      }},
    ]);
  };

  const grouped = STATUS_ORDER.map(s => ({ status: s, data: members.filter(m => m.rsvp_status === s) })).filter(g => g.data.length > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text, marginBottom: 8 }}>Members & RSVP</Text>
        <Pressable onPress={handleCopyLink} accessibilityLabel="Copy invite link" accessibilityHint="Copies the trip invite link to clipboard" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryMuted, borderRadius: 10, padding: 10, gap: 8 }}>
          <Copy size={16} color={colors.primary} />
          <Text style={{ flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.primary }} numberOfLines={1}>{`golftrip.app/join/${inviteCode}`}</Text>
          <Share2 size={16} color={colors.primary} />
        </Pressable>
      </Animated.View>

      {loading ? <LoadingSkeleton variant="list" /> : members.length === 0 ? (
        <EmptyState icon={<UserPlus size={40} color={colors.textSecondary} />} title="No members yet" description="Share the invite link to get your group together." />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={g => g.status}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMembers(); }} tintColor={colors.primary} />}
          renderItem={({ item: group, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.textSecondary }}>{STATUS_LABEL[group.status]}</Text>
                <View style={{ marginLeft: 8, backgroundColor: colors.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary }}>{group.data.length}</Text>
                </View>
              </View>
              {group.data.map(member => (
                <MemberRow key={member.id} member={member} isOrganizer={isOrganizer} isMe={member.id === myMemberId} onRsvpToggle={() => handleRsvpToggle(member.id, member.rsvp_status)} onRemove={() => handleRemove(member.id)} />
              ))}
            </Animated.View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
