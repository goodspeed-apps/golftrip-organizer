import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Copy, UserPlus, Mail, MessageSquare } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast, useToast } from '@/components/ui/Toast';
import MemberRow from '@/components/MemberRow';

type RsvpStatus = 'coming' | 'pending' | 'declined';

interface TripMember {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  role: string;
  rsvp_status: RsvpStatus;
  days_playing: string[];
  display_name?: string;
  avatar_url?: string | null;
}

export default function MembersScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();

  const [members, setMembers] = useState<TripMember[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    const start = Date.now();
    try {
      const end = trackApiLatency('fetch_trip_members');
      const [{ data: trip }, { data: rows }] = await Promise.all([
        supabase.from('trips').select('organizer_id, invite_code').eq('id', id).single(),
        supabase
          .from('trip_members')
          .select('id, user_id, guest_name, guest_email, role, rsvp_status, days_playing, users(display_name, avatar_url)')
          .eq('trip_id', id),
      ]);
      end?.();
      if (trip) {
        setInviteCode(trip.invite_code ?? '');
        setIsOrganizer(trip.organizer_id === user?.id);
      }
      const mapped: TripMember[] = (rows ?? []).map((r: Record<string, unknown>) => {
        const u = r.users as { display_name?: string; avatar_url?: string } | null;
        return {
          id: r.id as string,
          user_id: r.user_id as string | null,
          guest_name: r.guest_name as string | null,
          guest_email: r.guest_email as string | null,
          role: r.role as string,
          rsvp_status: (r.rsvp_status as RsvpStatus) ?? 'pending',
          days_playing: (r.days_playing as string[]) ?? [],
          display_name: u?.display_name ?? (r.guest_name as string) ?? 'Guest',
          avatar_url: u?.avatar_url ?? null,
        };
      });
      setMembers(mapped);
      const me = mapped.find(m => m.user_id === user?.id);
      setMyMemberId(me?.id ?? null);
      setError(false);
      trackScreenLoad('members_rsvp', start);
    } catch (e) {
      captureException(e, { screen: 'members_rsvp', action: 'fetch' });
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    track('screen_view_members_rsvp', { trip_id: id });
    fetchMembers();
  }, [fetchMembers]);

  const handleCopyLink = async () => {
    const link = `https://golftrip.app/join/${inviteCode}`;
    await Clipboard.setStringAsync(link);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Invite link copied!', 'success');
    track('copy_invite_link', { trip_id: id });
    setTimeout(() => Share.share({ message: link, title: 'Join our golf trip!' }), 800);
  };

  const handleUpdateRsvp = async (status: RsvpStatus) => {
    if (!myMemberId) return;
    track('rsvp_update', { trip_id: id, status });
    const { error: err } = await supabase
      .from('trip_members')
      .update({ rsvp_status: status, updated_at: new Date().toISOString() })
      .eq('id', myMemberId);
    if (err) { captureException(err, { screen: 'members_rsvp', action: 'update_rsvp' }); return; }
    setMembers(prev => prev.map(m => m.id === myMemberId ? { ...m, rsvp_status: status } : m));
    Haptics.selectionAsync();
  };

  const handleRemove = async (memberId: string) => {
    Alert.alert('Remove Member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          track('remove_member', { trip_id: id, member_id: memberId });
          const { error: err } = await supabase.from('trip_members').delete().eq('id', memberId);
          if (err) { captureException(err, { screen: 'members_rsvp', action: 'remove_member' }); return; }
          setMembers(prev => prev.filter(m => m.id !== memberId));
        },
      },
    ]);
  };

  const groups: { label: string; status: RsvpStatus; emoji: string }[] = [
    { label: 'Coming', status: 'coming', emoji: '⛳' },
    { label: 'Pending', status: 'pending', emoji: '🕐' },
    { label: 'Declined', status: 'declined', emoji: '❌' },
  ];

  const listData = groups.flatMap(g => {
    const filtered = members.filter(m => m.rsvp_status === g.status);
    if (!filtered.length) return [];
    return [
      { type: 'header' as const, ...g, count: filtered.length },
      ...filtered.map(m => ({ type: 'member' as const, member: m })),
    ];
  });

  const myStatus = members.find(m => m.id === myMemberId)?.rsvp_status;

  const rsvpOptions: { label: string; status: RsvpStatus }[] = [
    { label: "I'm coming!", status: 'coming' },
    { label: 'Not sure', status: 'pending' },
    { label: "Can't make it", status: 'declined' },
  ];

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <LoadingSkeleton variant="list" />
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <EmptyState icon="wifi-off" title="Couldn't load members" description="Check your connection and try again" action={{ label: 'Retry', onPress: fetchMembers }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast {...toast} />

      {/* Sticky invite bar */}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, padding: 12, gap: 8 }}>
        <Pressable
          onPress={handleCopyLink}
          accessibilityLabel="Copy invite link"
          accessibilityHint="Copies the invite link to clipboard and opens share sheet"
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryMuted, borderRadius: 10, padding: 12, gap: 8 }}>
          <Copy size={18} color={colors.primary} />
          <Text style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.primary }} numberOfLines={1}>
            golftrip.app/join/{inviteCode}
          </Text>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary }}>Copy</Text>
        </Pressable>

        {!isOrganizer && myMemberId && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {rsvpOptions.map(opt => (
              <Pressable
                key={opt.status}
                onPress={() => handleUpdateRsvp(opt.status)}
                accessibilityLabel={`RSVP ${opt.label}`}
                accessibilityHint={`Set your RSVP status to ${opt.label}`}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center',
                  backgroundColor: myStatus === opt.status ? colors.primary : colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: myStatus === opt.status ? colors.primary : colors.border,
                }}>
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: myStatus === opt.status ? colors.textOnPrimary : colors.text }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item, i) => item.type === 'header' ? `hdr-${item.status}` : `mbr-${item.member.id}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMembers(); }} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState icon="users" title="No members yet" description="Share the invite link to get the crew together!" />}
        renderItem={({ item, index }) => {
          if (item.type === 'header') return (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, gap: 6 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary }}>{item.emoji} {item.label}</Text>
              <View style={{ backgroundColor: colors.primaryMuted, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: colors.primary }}>{item.count}</Text>
              </View>
            </View>
          );
          return (
            <Animated.View entering={FadeInDown.delay(40 * index).duration(300)}>
              <MemberRow
                member={item.member}
                isOrganizer={isOrganizer}
                onRemove={isOrganizer ? () => handleRemove(item.member.id) : undefined}
              />
            </Animated.View>
          );
        }}
      />

      {isOrganizer && (
        <View style={{ padding: 16, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Pressable
            onPress={() => track('invite_via_sms', { trip_id: id })}
            accessibilityLabel="Invite via SMS"
            accessibilityHint="Opens SMS to invite someone to the trip"
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primaryMuted, borderRadius: 12, padding: 13 }}>
            <MessageSquare size={16} color={colors.primary} />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.primary }}>SMS</Text>
          </Pressable>
          <Pressable
            onPress={() => track('invite_via_email', { trip_id: id })}
            accessibilityLabel="Invite via Email"
            accessibilityHint="Opens email client to invite someone to the trip"
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.secondaryMuted, borderRadius: 12, padding: 13 }}>
            <Mail size={16} color={colors.secondary} />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.secondary }}>Email</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
