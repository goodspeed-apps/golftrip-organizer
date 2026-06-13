import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Alert, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Users, Copy, Mail, UserMinus } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
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
  display_name: string;
  avatar_url: string | null;
}

const STATUS_ORDER: RsvpStatus[] = ['coming', 'pending', 'declined'];
const STATUS_LABELS: Record<RsvpStatus, string> = { coming: 'Coming', pending: 'Pending', declined: "Can't Make It" };

export default function MembersScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { showToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [organizerId, setOrganizerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const startTime = React.useRef(Date.now());

  const isOrganizer = user?.id === organizerId;
  const myMember = members.find(m => m.user_id === user?.id);

  const fetchData = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    const done = trackApiLatency('fetch_members');
    try {
      const [tripRes, membersRes] = await Promise.all([
        supabase.from('trips').select('organizer_id, invite_code').eq('id', id).single(),
        supabase.from('trip_members').select('id, user_id, guest_name, guest_email, role, rsvp_status, days_playing, users(display_name, avatar_url)').eq('trip_id', id),
      ]);
      if (tripRes.error) throw tripRes.error;
      if (membersRes.error) throw membersRes.error;
      setOrganizerId(tripRes.data.organizer_id);
      setInviteCode(tripRes.data.invite_code ?? '');
      const mapped: Member[] = (membersRes.data ?? []).map((m: Record<string, unknown>) => {
        const u = m.users as { display_name?: string; avatar_url?: string } | null;
        return {
          id: m.id as string,
          user_id: m.user_id as string | null,
          guest_name: m.guest_name as string | null,
          guest_email: m.guest_email as string | null,
          role: m.role as string,
          rsvp_status: (m.rsvp_status as RsvpStatus) ?? 'pending',
          days_playing: (m.days_playing as string[]) ?? [],
          display_name: u?.display_name ?? (m.guest_name as string) ?? 'Guest',
          avatar_url: u?.avatar_url ?? null,
        };
      });
      setMembers(mapped);
      trackScreenLoad('members_rsvp', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'members_rsvp', action: 'fetchData' });
    } finally {
      done();
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { track('screen_view_members_rsvp', { trip_id: id }); fetchData(); }, []);

  const handleCopyInvite = async () => {
    const link = `https://golftrip.app/join/${inviteCode}`;
    await Clipboard.setStringAsync(link);
    showToast('Copied!', 'success');
    track('copy_invite_link', { trip_id: id });
    setTimeout(() => Share.share({ message: link }), 400);
  };

  const handleRsvpToggle = async (status: RsvpStatus) => {
    if (!myMember) return;
    const next: RsvpStatus = status === 'coming' ? 'pending' : status === 'pending' ? 'declined' : 'coming';
    setMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, rsvp_status: next } : m));
    track('rsvp_toggle', { trip_id: id, status: next });
    const { error } = await supabase.from('trip_members').update({ rsvp_status: next }).eq('id', myMember.id);
    if (error) { captureException(error, { screen: 'members_rsvp', action: 'rsvpToggle' }); fetchData(); }
  };

  const handleRemove = (memberId: string, name: string) => {
    Alert.alert('Remove Member', `Remove ${name} from this trip?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        track('remove_member', { trip_id: id });
        const { error } = await supabase.from('trip_members').delete().eq('id', memberId);
        if (error) captureException(error, { screen: 'members_rsvp', action: 'removeMember' });
        else setMembers(prev => prev.filter(m => m.id !== memberId));
      }},
    ]);
  };

  const sections = STATUS_ORDER.map(s => ({ status: s, data: members.filter(m => m.rsvp_status === s) })).filter(s => s.data.length > 0);

  const renderHeader = () => (
    <Animated.View entering={FadeInDown.delay(0).duration(400)}>
      <Pressable
        onPress={handleCopyInvite}
        accessibilityLabel="Copy invite link" accessibilityHint="Copies and shares the trip invite link"
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, margin: 16, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}
      >
        <Copy size={18} color={colors.primary} />
        <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Invite Link  ·  golftrip.app/join/{inviteCode}</Text>
        <View style={{ backgroundColor: colors.primaryMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Copy + Share</Text>
        </View>
      </Pressable>
    </Animated.View>
  );

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={sections.flatMap((s, si) => [
          { type: 'header' as const, status: s.status, count: s.data.length, key: `h-${s.status}` },
          ...s.data.map((m, i) => ({ type: 'member' as const, member: m, sectionIndex: si, itemIndex: i, key: m.id })),
        ])}
        keyExtractor={item => item.key}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<EmptyState icon={Users} title="No members yet" subtitle="Share the invite link to get started" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
        renderItem={({ item, index }) => {
          if (item.type === 'header') {
            return (
              <Animated.View entering={FadeInDown.delay(50 * index).duration(300)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 8 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 }}>{STATUS_LABELS[item.status]}</Text>
                <View style={{ backgroundColor: colors.primaryMuted, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11 }}>{item.count}</Text>
                </View>
              </Animated.View>
            );
          }
          const { member } = item;
          const isMe = member.user_id === user?.id;
          return (
            <Animated.View entering={FadeInDown.delay(50 * index).duration(350)}>
              <MemberRow
                member={member}
                isOrganizer={isOrganizer}
                isMe={isMe}
                onRsvpToggle={() => handleRsvpToggle(member.rsvp_status)}
                onRemove={() => handleRemove(member.id, member.display_name)}
              />
            </Animated.View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
